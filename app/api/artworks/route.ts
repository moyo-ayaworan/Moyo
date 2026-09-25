import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

type ArtworkUpdateKey =
  | 'title'
  | 'price'
  | 'image'
  | 'category'
  | 'year'
  | 'medium'
  | 'dimensions'
  | 'description'
  | 'isFeatured'
  | 'isAvailable'
  | 'availabilityStatus';

type ArtworkPayload = {
  title?: unknown;
  price?: unknown;
  image?: unknown;
  category?: unknown;
  year?: unknown;
  medium?: unknown;
  dimensions?: unknown;
  description?: unknown;
  isFeatured?: unknown;
  isAvailable?: unknown;
  availabilityStatus?: unknown;
};

function normalizeArtworkPayload(body: ArtworkPayload) {
  return {
    title: String(body.title || '').trim(),
    price: Number(body.price || 0),
    image: String(body.image || '').trim(),
    category: String(body.category || '').trim(),
    year: String(body.year || '').trim(),
    medium: String(body.medium || '').trim(),
    dimensions: String(body.dimensions || '').trim(),
    description: String(body.description || '').trim(),
    isFeatured: body.isFeatured ?? false,
    isAvailable: body.isAvailable ?? false,
    availabilityStatus: ['available', 'reserved', 'sold', 'commissioned', 'exhibition', 'archive'].includes(String(body.availabilityStatus)) ? String(body.availabilityStatus) : body.isAvailable ? 'available' : 'archive',
  };
}

async function createArtwork(body: ArtworkPayload) {
  const artwork = normalizeArtworkPayload(body);
  if (!artwork.title || !artwork.image || !artwork.category) {
    throw new Error('Title, image, and category are required.');
  }

  const creationKey = createHash('sha256').update(JSON.stringify(artwork)).digest('hex');
  const { rows } = await query(
    `INSERT INTO artworks (title, price, image, category, year, medium, dimensions, description, is_featured, is_available, availability_status, creation_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key
     RETURNING *`,
    [
      artwork.title,
      artwork.price,
      artwork.image,
      artwork.category,
      artwork.year,
      artwork.medium,
      artwork.dimensions,
      artwork.description,
      artwork.isFeatured,
      artwork.isAvailable,
      artwork.availabilityStatus,
      creationKey,
    ]
  );

  return rows[0];
}

export async function GET() {
  const { rows } = await query('SELECT * FROM artworks ORDER BY created_at DESC');
  return NextResponse.json({ artworks: rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as Record<string, unknown>;
    const incomingArtworks = Array.isArray(body.artworks) ? body.artworks : null;

    if (incomingArtworks) {
      const artworks = [];
      for (const item of incomingArtworks) {
        artworks.push(await createArtwork(item as ArtworkPayload));
      }
      return NextResponse.json({ artworks });
    }

    const artwork = await createArtwork(body as ArtworkPayload);
    return NextResponse.json({ artwork });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create artwork.' },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json() as Record<string, unknown>;
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of ['title', 'price', 'image', 'category', 'year', 'medium', 'dimensions', 'description', 'isFeatured', 'isAvailable', 'availabilityStatus'] satisfies ArtworkUpdateKey[]) {
    if (key in updates) {
      const col = key === 'isFeatured' ? 'is_featured' : key === 'isAvailable' ? 'is_available' : key === 'availabilityStatus' ? 'availability_status' : key;
      fields.push(`${col} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }
  if (!fields.length) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  values.push(id);

  const { rows } = await query(
    `UPDATE artworks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return NextResponse.json({ artwork: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await query('DELETE FROM artworks WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
