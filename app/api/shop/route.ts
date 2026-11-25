import { publicStoreProduct } from '@/lib/productStory';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isProductSection } from '@/lib/productSections';
export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get('section') || 'art';
  if (!isProductSection(section)) return NextResponse.json({ error: 'Unknown collection.' }, { status: 400 });
  try {
    const [artworks, products, contact] = await Promise.all([
      section === 'art' ? query(`SELECT id,title,price,image,medium,dimensions,description,availability_status FROM artworks WHERE is_available=TRUE AND availability_status='available' ORDER BY created_at DESC`) : Promise.resolve({ rows: [] }),
      query(`SELECT id,title,price,details,image,section,storefront,(product_url <> '') AS has_delivery_file FROM digital_products WHERE is_active=TRUE AND section=$1 ORDER BY display_order ASC,created_at DESC`, [section]),
      query('SELECT email FROM contact WHERE id=1'),
    ]);
    return NextResponse.json({ artworks: artworks.rows, products: products.rows.map(publicStoreProduct), section, email: contact.rows[0]?.email || 'moyoayaworan@gmail.com', checkout_enabled: Boolean(process.env.PAYSTACK_SECRET_KEY && (process.env.VERCEL_ENV !== 'production' || process.env.PAYSTACK_WEBHOOK_SECRET)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'The collection could not be loaded. Please try again.' }, { status: 503 }); }
}
