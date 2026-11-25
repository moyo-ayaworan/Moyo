import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import slugify from 'slugify';

function normalizeSlug(value: string) {
  return slugify(value, { lower: true, strict: true });
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { rows } = await query(`
    SELECT
      c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', i.id,
            'category_id', i.category_id,
            'image_url', i.image_url,
            'title', i.title,
            'alt_text', i.alt_text,
            'display_order', i.display_order,
            'created_at', i.created_at
          )
          ORDER BY i.display_order ASC, i.created_at DESC
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
      ) AS images
    FROM photography_categories c
    LEFT JOIN photography_category_images i ON i.category_id = c.id
    GROUP BY c.id
    ORDER BY c.display_order ASC, c.created_at DESC
  `);

  return NextResponse.json({ categories: rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const name = String(body.name || '').trim();
  const slug = normalizeSlug(String(body.slug || name));

  if (!name || !slug) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO photography_categories (name, slug, description, cover_image_url, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      name,
      slug,
      String(body.description || '').trim(),
      String(body.cover_image_url || '').trim(),
      Number(body.display_order || 0),
      body.is_active ?? true,
    ]
  );

  return NextResponse.json({ category: { ...rows[0], images: [] } });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const id = Number(body.id);
  const name = String(body.name || '').trim();
  const slug = normalizeSlug(String(body.slug || name));

  if (!id || !name || !slug) {
    return NextResponse.json({ error: 'Category id and name are required' }, { status: 400 });
  }

  const { rows } = await query(
    `UPDATE photography_categories
     SET name=$1, slug=$2, description=$3, cover_image_url=$4, display_order=$5, is_active=$6, updated_at=NOW()
     WHERE id=$7
     RETURNING *`,
    [
      name,
      slug,
      String(body.description || '').trim(),
      String(body.cover_image_url || '').trim(),
      Number(body.display_order || 0),
      body.is_active ?? true,
      id,
    ]
  );

  if (!rows[0]) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  return NextResponse.json({ category: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await query('DELETE FROM photography_categories WHERE id=$1', [id]);
  return NextResponse.json({ success: true });
}

// Save the complete category order in one statement so partial reorders cannot occur.
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;
  const body = await req.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 ||
      ids.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) < 1) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Provide each category once in the preferred order.' }, { status: 400 });
  }
  const { rows } = await query(`
    WITH requested AS (
      SELECT id, position - 1 AS display_order
      FROM unnest($1::int[]) WITH ORDINALITY AS chosen(id, position)
    ), valid AS (
      SELECT 1 WHERE (SELECT COUNT(*) FROM photography_categories) = cardinality($1::int[])
      AND NOT EXISTS (SELECT 1 FROM requested r LEFT JOIN photography_categories c ON c.id = r.id WHERE c.id IS NULL)
    )
    UPDATE photography_categories c SET display_order = r.display_order, updated_at = NOW()
    FROM requested r, valid WHERE c.id = r.id RETURNING c.id, c.display_order
  `, [ids]);
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: 'Categories have changed. Refresh and try again.' }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
