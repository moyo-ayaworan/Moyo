import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

type DigitalProductUpdateKey =
  | 'title'
  | 'price'
  | 'details'
  | 'image'
  | 'productUrl'
  | 'displayOrder'
  | 'isActive';

export async function GET() {
  const { rows } = await query(`
    SELECT *
    FROM digital_products
    ORDER BY is_active DESC, display_order ASC, created_at DESC
  `);

  return NextResponse.json({ products: rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const title = String(body.title || '').trim();
  const price = String(body.price || '').trim();
  const details = String(body.details || '').trim();
  const image = String(body.image || '').trim();
  const productUrl = String(body.productUrl || '').trim();
  const displayOrder = Number(body.displayOrder || 0);
  const isActive = body.isActive ?? true;

  if (!title || !price || !image) {
    return NextResponse.json({ error: 'Title, price, and image are required.' }, { status: 400 });
  }

  const creationKey = createHash('sha256').update(JSON.stringify({ title, price, details, image, productUrl, displayOrder, isActive })).digest('hex');
  const { rows } = await query(
    `INSERT INTO digital_products (title, price, details, image, product_url, display_order, is_active, creation_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key
     RETURNING *`,
    [title, price, details, image, productUrl, displayOrder, isActive, creationKey]
  );

  return NextResponse.json({ product: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing product id.' }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ['title', 'price', 'details', 'image', 'productUrl', 'displayOrder', 'isActive'] satisfies DigitalProductUpdateKey[]) {
    if (key in body) {
      const col =
        key === 'productUrl'
          ? 'product_url'
          : key === 'displayOrder'
            ? 'display_order'
            : key === 'isActive'
              ? 'is_active'
              : key;
      fields.push(`${col} = $${idx}`);
      values.push(key === 'displayOrder' ? Number(body[key] || 0) : body[key]);
      idx++;
    }
  }

  if (!fields.length) {
    return NextResponse.json({ error: 'No updates provided.' }, { status: 400 });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE digital_products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  return NextResponse.json({ product: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing product id.' }, { status: 400 });

  await query('DELETE FROM digital_products WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
