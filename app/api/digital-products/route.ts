import { parseProductStory, publicStoreProduct, publicProductImage } from '@/lib/productStory';
import { readJsonRequest } from '@/lib/requestBody';
import { isProductSection } from '@/lib/productSections';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { priceToKobo } from '@/lib/paystack';
import { query } from '@/lib/db';
import { parseAuthenticatedAsset } from '@/lib/privateMedia';

type DigitalProductUpdateKey =
  | 'storefront'
  | 'section'
  | 'title'
  | 'price'
  | 'details'
  | 'image'
  | 'productUrl'
  | 'displayOrder'
  | 'isActive';

export async function GET(req: NextRequest) {
  const isAdmin = !(await requireAdmin(req));
  const requestedSection = req.nextUrl.searchParams.get('section');
  const section = requestedSection || 'photography';
  if (!isProductSection(section)) return NextResponse.json({ error: 'Unknown product collection.' }, { status: 400 });
  const allSections = isAdmin && !requestedSection;
  const { rows } = await query(`
    SELECT ${isAdmin ? '*' : 'id,title,price,details,image,display_order,is_active,section,product_kind,storefront,(product_url <> \'\') AS has_delivery_file'} FROM digital_products
    ${allSections ? '' : `WHERE section=$1 ${isAdmin ? '' : 'AND is_active=TRUE'}`}
    ORDER BY is_active DESC, display_order ASC, created_at DESC
  `, allSections ? [] : [section]);

  return NextResponse.json({ products: isAdmin ? rows : rows.map(product => ({...publicStoreProduct(product),display_order:product.display_order,is_active:product.is_active})) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

function normalizeProductUrl(value: unknown) {
  const productUrl = String(value || '').trim();
  if (!productUrl) return '';
  let parsed: URL;
  try { parsed = new URL(productUrl); }
  catch { throw new Error('Delivery file URL must be a complete HTTPS link.'); }
  if (parsed.protocol !== 'https:') throw new Error('Delivery file URL must use HTTPS.');
  if (!parseAuthenticatedAsset(parsed.toString())) throw new Error('Upload the delivery file as a private asset before selling it.');
  return parsed.toString();
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const parsed = await readJsonRequest(req, 131072);
  if (parsed.response) return parsed.response;
  const body = parsed.body as Record<string, unknown>;
  const section = body.section || 'photography';
  if (!isProductSection(section)) return NextResponse.json({ error: 'Choose Photography or Fine Art.' }, { status: 400 });
  const title = String(body.title || '').trim();
  const price = String(body.price || '').trim();
  try { priceToKobo(price); } catch { return NextResponse.json({ error: 'Use an NGN price such as ₦20,000.' }, { status: 400 }); }
  let storefront;
  try { storefront = parseProductStory(body.storefront); } catch (error) { return NextResponse.json({error:(error as Error).message},{status:400}); }
  const details = String(body.details || '').trim();
  const image = String(body.image || '').trim();
  if (image && !publicProductImage(image)) return NextResponse.json({error:'Use a public product image or upload one. Keep the paid file in Protected Delivery File.'},{status:400});
  let productUrl: string;
  try { productUrl = normalizeProductUrl(body.productUrl); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const displayOrder = Number(body.displayOrder || 0);
  const isActive = body.isActive ?? true;

  if (!title || !price) {
    return NextResponse.json({ error: 'Title and price are required.' }, { status: 400 });
  }

  const creationKey = createHash('sha256').update(JSON.stringify({ title, price, details, image, productUrl, displayOrder, isActive, section, storefront })).digest('hex');
  const { rows } = await query(
    `INSERT INTO digital_products (title, price, details, image, product_url, display_order, is_active, section, creation_key, storefront)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key
     RETURNING *`,
    [title, price, details, image, productUrl, displayOrder, isActive, section, creationKey, JSON.stringify(storefront)]
  );

  return NextResponse.json({ product: rows[0] });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const parsed = await readJsonRequest(req, 131072);
  if (parsed.response) return parsed.response;
  const body = parsed.body as Record<string, unknown>;
  if ('image' in body && (typeof body.image !== 'string' || (body.image !== '' && !publicProductImage(body.image)))) return NextResponse.json({error:'Use a public product image or upload one.'},{status:400});
  if ('section' in body && !isProductSection(body.section)) return NextResponse.json({ error: 'Choose Photography or Fine Art.' }, { status: 400 });
  if ('price' in body) { try { priceToKobo(String(body.price)); } catch { return NextResponse.json({ error: 'Use an NGN price such as ₦20,000.' }, { status: 400 }); }
  }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'Missing product id.' }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ['section', 'title', 'price', 'details', 'image', 'productUrl', 'displayOrder', 'isActive', 'storefront'] satisfies DigitalProductUpdateKey[]) {
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
      try {
        values.push(key === 'storefront' ? JSON.stringify(parseProductStory(body[key])) : key === 'displayOrder' ? Number(body[key] || 0) : key === 'productUrl' ? normalizeProductUrl(body[key]) : body[key]);
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
      }
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
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing product id.' }, { status: 400 });

  const existing=(await query('SELECT product_kind FROM digital_products WHERE id=$1',[id])).rows[0];
  if(existing?.product_kind==='physical')return NextResponse.json({error:'Unpublish this physical product from Inventory to preserve its stock and order history.'},{status:409});
  await query('DELETE FROM digital_products WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
