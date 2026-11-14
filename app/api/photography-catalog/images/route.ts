import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const categoryId = Number(body.category_id);
  const imageUrl = String(body.image_url || '').trim();

  if (!categoryId || !imageUrl) {
    return NextResponse.json({ error: 'Category and image are required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO photography_category_images (category_id, image_url, title, alt_text, display_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (category_id, image_url)
     DO UPDATE SET
       title = EXCLUDED.title,
       alt_text = EXCLUDED.alt_text,
       display_order = EXCLUDED.display_order,
       updated_at = NOW()
     RETURNING *`,
    [
      categoryId,
      imageUrl,
      String(body.title || '').trim(),
      String(body.alt_text || '').trim(),
      Number(body.display_order || 0),
    ]
  );

  return NextResponse.json({ image: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const id = Number(body.id);
  const categoryId = Number(body.category_id);
  const imageUrl = String(body.image_url || '').trim();

  if (!id || !categoryId || !imageUrl) {
    return NextResponse.json({ error: 'Image id, category and image are required' }, { status: 400 });
  }

  try {
    const { rows } = await query(
    `UPDATE photography_category_images
     SET category_id=$1, image_url=$2, title=$3, alt_text=$4, display_order=$5, updated_at=NOW()
     WHERE id=$6
     RETURNING *`,
    [
      categoryId,
      imageUrl,
      String(body.title || '').trim(),
      String(body.alt_text || '').trim(),
      Number(body.display_order || 0),
      id,
    ]
  );

  if (!rows[0]) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  return NextResponse.json({ image: rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This photo is already in that category.' }, { status: 409 });
    }
    if ((error as { code?: string }).code === '23503') {
      return NextResponse.json({ error: 'The destination category no longer exists. Refresh and try again.' }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await query('DELETE FROM photography_category_images WHERE id=$1', [id]);
  return NextResponse.json({ success: true });
}
