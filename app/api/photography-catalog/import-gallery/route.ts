import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { isImageUrl } from '@/lib/mediaUrl';
import { parseAuthenticatedAsset, signedGalleryPreview } from '@/lib/privateMedia';

type Selection = { kind: 'uploaded' | 'finished'; index: number };

function catalogueImageUrl(source: string, kind: Selection['kind']) {
  const privateAsset = parseAuthenticatedAsset(source);
  if (privateAsset) {
    return privateAsset.resourceType === 'image' ? signedGalleryPreview(source) : null;
  }
  if (kind === 'finished') return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
    if (url.pathname.split('/')[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;
    if (!url.pathname.includes('/image/upload/') || !isImageUrl(source)) return null;
    return source;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.category_id);
  const galleryId = Number(body?.gallery_id);
  const selections = body?.selections as Selection[] | undefined;
  if (!Number.isSafeInteger(categoryId) || categoryId < 1 || !Number.isSafeInteger(galleryId) || galleryId < 1 ||
      !Array.isArray(selections) || selections.length < 1 || selections.length > 100 ||
      selections.some((item) => !item || !['uploaded', 'finished'].includes(item.kind) || !Number.isSafeInteger(item.index) || item.index < 0)) {
    return NextResponse.json({ error: 'Choose a category, a client gallery, and up to 100 images.' }, { status: 400 });
  }

  const [{ rows: categories }, { rows: galleries }] = await Promise.all([
    query('SELECT id, cover_image_url FROM photography_categories WHERE id=$1 LIMIT 1', [categoryId]),
    query('SELECT images, finished_images FROM galleries WHERE id=$1 LIMIT 1', [galleryId]),
  ]);
  if (!categories[0] || !galleries[0]) {
    return NextResponse.json({ error: 'Category or client gallery not found.' }, { status: 404 });
  }

  const gallery = galleries[0] as { images?: string[]; finished_images?: string[] };
  const urls: string[] = [];
  for (const selection of selections) {
    const source = (selection.kind === 'finished' ? gallery.finished_images : gallery.images)?.[selection.index];
    const url = typeof source === 'string' ? catalogueImageUrl(source, selection.kind) : null;
    if (!url) return NextResponse.json({ error: 'One selected image is no longer available for the catalogue.' }, { status: 400 });
    if (!urls.includes(url)) urls.push(url);
  }

  const { rows: images } = await query(
    `INSERT INTO photography_category_images (category_id, image_url, title, alt_text, display_order)
     SELECT $1, chosen.image_url, '', '', 0
     FROM unnest($2::text[]) WITH ORDINALITY AS chosen(image_url, position)
     ON CONFLICT (category_id, image_url) DO NOTHING
     RETURNING *`,
    [categoryId, urls]
  );
  const { rows: covers } = await query(
    `UPDATE photography_categories
     SET cover_image_url = CASE WHEN COALESCE(cover_image_url, '') = '' THEN $2 ELSE cover_image_url END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING cover_image_url`,
    [categoryId, urls[0]]
  );

  return NextResponse.json({ images, cover_image_url: covers[0]?.cover_image_url || '', skipped: urls.length - images.length },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
