import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import slugify from 'slugify';
import { randomBytes } from 'node:crypto';

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

  return NextResponse.json({ gallery: rows[0] });
}

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { rows } = await query('SELECT * FROM galleries ORDER BY created_at DESC');
  return NextResponse.json({ galleries: rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
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
      is_locked
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      slug,
      access_code,
      body.clientName,
      body.images || [],
      body.approvedImages || [],
      body.finishedImages || [],
      body.paymentVerified ?? false,
      body.paymentUrl || '',
      body.isLocked ?? false,
    ]
  );
  return NextResponse.json({ gallery: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
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
         is_locked=$9
     WHERE id=$10
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
      payload?.isLocked ?? false,
      id,
    ]
  );
  return galleryResponse(rows);
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await query('DELETE FROM galleries WHERE id=$1', [id]);
  return NextResponse.json({ success: true });
}
