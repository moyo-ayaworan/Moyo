import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [artworks, products, contact] = await Promise.all([
      query(`SELECT id, title, price, image, medium, dimensions, description, availability_status
             FROM artworks WHERE is_available = TRUE AND availability_status = 'available' ORDER BY created_at DESC`),
      query(`SELECT id, title, price, details, image
             FROM digital_products WHERE is_active = TRUE
             ORDER BY display_order ASC, created_at DESC`),
      query('SELECT email FROM contact WHERE id = 1'),
    ]);

    return NextResponse.json({
      artworks: artworks.rows,
      products: products.rows,
      email: contact.rows[0]?.email || 'ijabikenm@gmail.com',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[shop] Failed to load collection:', error);
    return NextResponse.json({ error: 'The collection could not be loaded. Please try again.' }, { status: 503 });
  }
}
