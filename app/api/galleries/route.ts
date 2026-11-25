import { isImagePosition } from '@/lib/imagePosition';
import { normalizeGalleryPresentation } from '@/lib/galleryPresentation';
import { isImageUrl } from '@/lib/mediaUrl';
import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import slugify from 'slugify';
import { randomBytes } from 'node:crypto';
import { signedGallerySoundtrack, signedGalleryPreview } from '@/lib/privateMedia';

type GalleryRow = {
  id: number;
};

function randomCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}

function galleryResponse(rows: GalleryRow[]) {
  if (!rows[0]) {
    return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
  }

  return NextResponse.json({ gallery: {
    ...rows[0],
    soundtrack_preview: signedGallerySoundtrack((rows[0] as { soundtrack_url?: string }).soundtrack_url || ''),
    image_previews: ((rows[0] as { images?: string[] }).images || []).map((image) => signedGalleryPreview(image) || image),
    finished_previews: ((rows[0] as { finished_images?: string[] }).finished_images || []).map((image) => signedGalleryPreview(image) || ''),
  } });
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { rows } = await query('SELECT * FROM galleries ORDER BY created_at DESC');
  return NextResponse.json({ galleries: rows.map((gallery) => ({
    ...gallery,
    soundtrack_preview: signedGallerySoundtrack(gallery.soundtrack_url || ''),
    image_previews: (gallery.images || []).map((image: string) => signedGalleryPreview(image) || image),
    finished_previews: (gallery.finished_images || []).map((image: string) => signedGalleryPreview(image) || ''),
  })) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const slug = body.slug || slugify(body.clientName || 'gallery', { lower: true, strict: true });
  const access_code = body.access_code || randomCode();

  const { rows } = await query(
    `INSERT INTO galleries (
      slug,
      access_code,
      client_name,
      images,
      approved_images,
      finished_images,
      payment_verified,
      payment_url,
      gallery_design,
      is_locked
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      slug,
      access_code,
      body.clientName,
      body.images || [],
      body.approvedImages || [],
      body.finishedImages || [],
      body.paymentVerified ?? false,
      body.paymentUrl || '',
      ['editorial', 'classic', 'proofing'].includes(body.galleryDesign) ? body.galleryDesign : 'editorial',
      body.isLocked ?? false,
    ]
  );
  return NextResponse.json({ gallery: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const { id, action, payload } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (action === 'addImages') {
    const { rows } = await query(
      `UPDATE galleries
       SET images = ARRAY(
         SELECT image
         FROM (
           SELECT image, MIN(position) AS first_position
           FROM unnest(COALESCE(images, ARRAY[]::text[]) || $1::text[]) WITH ORDINALITY AS combined(image, position)
           GROUP BY image
         ) unique_images
         ORDER BY first_position
       )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'addFinishedImages') {
    const { rows } = await query(
      `UPDATE galleries
       SET finished_images = ARRAY(
         SELECT image
         FROM (
           SELECT image, MIN(position) AS first_position
           FROM unnest(COALESCE(finished_images, ARRAY[]::text[]) || $1::text[]) WITH ORDINALITY AS combined(image, position)
           GROUP BY image
         ) unique_images
         ORDER BY first_position
       )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'removeImages') {
    const { rows } = await query(
      `UPDATE galleries
       SET images = ARRAY(
             SELECT image
             FROM unnest(COALESCE(images, ARRAY[]::text[])) WITH ORDINALITY AS existing(image, position)
             WHERE NOT image = ANY($1::text[])
             ORDER BY position
           ),
           approved_images = ARRAY(
             SELECT image
             FROM unnest(COALESCE(approved_images, ARRAY[]::text[])) WITH ORDINALITY AS existing(image, position)
             WHERE NOT image = ANY($1::text[])
             ORDER BY position
           )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'removeFinishedImage') {
    const { rows } = await query(
      `UPDATE galleries
       SET finished_images = ARRAY(
         SELECT image
         FROM unnest(COALESCE(finished_images, ARRAY[]::text[])) WITH ORDINALITY AS existing(image, position)
         WHERE NOT image = ANY($1::text[])
         ORDER BY position
       )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'approve') {
    const { rows } = await query(
      `UPDATE galleries
       SET approved_images = ARRAY(
         SELECT image
         FROM (
           SELECT image, MIN(position) AS first_position
           FROM unnest(COALESCE(approved_images, ARRAY[]::text[]) || $1::text[]) WITH ORDINALITY AS combined(image, position)
           GROUP BY image
         ) unique_images
         ORDER BY first_position
       )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'reject') {
    const { rows } = await query(
      `UPDATE galleries
       SET approved_images = ARRAY(
         SELECT image
         FROM unnest(COALESCE(approved_images, ARRAY[]::text[])) WITH ORDINALITY AS existing(image, position)
         WHERE NOT image = ANY($1::text[])
         ORDER BY position
       )
       WHERE id=$2
       RETURNING *`,
      [payload?.images || [], id]
    );
    return galleryResponse(rows);
  }
  if (action === 'payment') {
    const { rows } = await query(
      `UPDATE galleries SET payment_verified=$1, payment_url=$2 WHERE id=$3 RETURNING *`,
      [Boolean(payload?.paymentVerified), String(payload?.paymentUrl || ''), id]
    );
    return galleryResponse(rows);
  }
  if (action === 'lock' || action === 'unlock') {
    const { rows } = await query(
      `UPDATE galleries SET is_locked=$1 WHERE id=$2 RETURNING *`,
      [action === 'lock', id]
    );
    return galleryResponse(rows);
  }
  if (action === 'featureReview') {
    const { rows } = await query(
      `UPDATE galleries
       SET review_featured = $1
       WHERE id = $2
         AND review_submitted_at IS NOT NULL
       RETURNING *`,
      [Boolean(payload?.featured), id]
    );
    return galleryResponse(rows);
  }
  if (action === 'heroPosition') {
    if (!isImagePosition(payload?.position)) return NextResponse.json({ error: 'Image positions must be numbers between 0 and 100.' }, { status: 400 });
    const { rows } = await query('UPDATE galleries SET hero_position=$1::jsonb WHERE id=$2 RETURNING *', [JSON.stringify({ x: payload.position.x, y: payload.position.y }), id]);
    return galleryResponse(rows);
  }
  if (action === 'presentation') {
    if (payload?.settings !== null && (!payload?.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings))) {
      return NextResponse.json({ error: 'Valid gallery design settings are required.' }, { status: 400 });
    }
    const { rows: existing } = await query('SELECT images, finished_images FROM galleries WHERE id=$1', [id]);
    if (!existing[0]) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    const settings = payload.settings === null ? null : normalizeGalleryPresentation(payload.settings);
    if (settings?.coverImage && (!isImageUrl(settings.coverImage) || ![...(existing[0].images || []), ...(existing[0].finished_images || [])].includes(settings.coverImage))) {
      return NextResponse.json({ error: 'Choose a cover photograph from this gallery.' }, { status: 400 });
    }
    const { rows } = await query('UPDATE galleries SET presentation=$1::jsonb WHERE id=$2 RETURNING *', [settings ? JSON.stringify(settings) : null, id]);
    return galleryResponse(rows);
  }
  if (action === 'soundtrack') {
    const url = payload?.url;
    const title = payload?.title;
    if (typeof url !== 'string' || typeof title !== 'string' || title.length > 160 || (url !== '' && !signedGallerySoundtrack(url))) {
      return NextResponse.json({ error: 'Choose a private audio upload and a title up to 160 characters.' }, { status: 400 });
    }
    const { rows } = await query(
      'UPDATE galleries SET soundtrack_url=$1, soundtrack_title=$2 WHERE id=$3 RETURNING *',
      [url, url ? title.trim() : '', id]
    );
    return galleryResponse(rows);
  }
  if (action === 'design') {
    const design = ['editorial', 'classic', 'proofing'].includes(payload?.design)
      ? payload.design
      : 'editorial';
    const { rows } = await query(
      `UPDATE galleries SET gallery_design=$1 WHERE id=$2 RETURNING *`,
      [design, id]
    );
    return galleryResponse(rows);
  }

  // generic update
  const { rows } = await query(
    `UPDATE galleries
     SET client_name=$1,
         slug=$2,
         access_code=$3,
         images=$4,
         approved_images=$5,
         finished_images=$6,
         payment_verified=$7,
         payment_url=$8,
         gallery_design=$9,
         is_locked=$10
     WHERE id=$11
     RETURNING *`,
    [
      payload?.clientName,
      payload?.slug,
      payload?.access_code,
      payload?.images || [],
      payload?.approvedImages || [],
      payload?.finishedImages || [],
      payload?.paymentVerified ?? false,
      payload?.paymentUrl || '',
      ['editorial', 'classic', 'proofing'].includes(payload?.galleryDesign) ? payload.galleryDesign : 'editorial',
      payload?.isLocked ?? false,
      id,
    ]
  );
  return galleryResponse(rows);
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id || !/^[1-9]\d{0,8}$/.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  // Lock the parent before checking children: new documents cannot race this deletion.
  return transaction(async client => {
    const gallery = await client.query('SELECT id FROM galleries WHERE id=$1 FOR UPDATE', [id]);
    if (!gallery.rows.length) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    const documents = await client.query('SELECT id FROM gallery_documents WHERE gallery_id=$1 LIMIT 1', [id]);
    if (documents.rows.length) return NextResponse.json({ error: 'This gallery has financial documents. Retain it to preserve the invoice and payment history.' }, { status: 409 });
    await client.query('DELETE FROM galleries WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  });
}
