import { Pool, type PoolClient } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

function normalizeConnectionString(value: string) {
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get('sslmode');

    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode) && !url.searchParams.has('uselibpqcompat')) {
      url.searchParams.set('uselibpqcompat', 'true');
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

const pool = new Pool({
  connectionString: normalizeConnectionString(connectionString),
  ssl: { rejectUnauthorized: false },
});

let initialization: Promise<void> | undefined;

async function ensureTables() {
  if (!initialization) {
    initialization = initializeSafely().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
}

async function initializeSafely() {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    // Transaction locks also work with pooled production database connections.
    await connection.query('SELECT pg_advisory_xact_lock(178931, 1)');
    await initializeTables(connection);
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

async function initializeTables(connection: PoolClient) {

  await connection.query(`
    CREATE TABLE IF NOT EXISTS artworks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price NUMERIC NOT NULL,
      image TEXT NOT NULL,
      category TEXT NOT NULL,
      year TEXT DEFAULT '',
      medium TEXT DEFAULT '',
      dimensions TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_featured BOOLEAN DEFAULT FALSE,
      is_available BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS year TEXT DEFAULT '';
    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS medium TEXT DEFAULT '';
    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS dimensions TEXT DEFAULT '';
    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    ALTER TABLE artworks ALTER COLUMN is_available SET DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS galleries (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      access_code TEXT NOT NULL,
      client_name TEXT NOT NULL,
      images TEXT[] DEFAULT ARRAY[]::TEXT[],
      approved_images TEXT[] DEFAULT ARRAY[]::TEXT[],
      finished_images TEXT[] DEFAULT ARRAY[]::TEXT[],
      payment_verified BOOLEAN DEFAULT FALSE,
      payment_url TEXT DEFAULT '',
      review_rating INTEGER,
      review_text TEXT DEFAULT '',
      review_submitted_at TIMESTAMPTZ,
      review_featured BOOLEAN DEFAULT FALSE,
      gallery_design TEXT DEFAULT 'editorial',
      is_locked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gallery_documents (
      id SERIAL PRIMARY KEY,
      gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL DEFAULT 'invoice',
      title TEXT NOT NULL,
      client_email TEXT NOT NULL,
      amount NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'NGN',
      due_date TEXT DEFAULT '',
      line_items TEXT DEFAULT '',
      terms TEXT DEFAULT '',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS content (
      id SERIAL PRIMARY KEY,
      homepage_hero_text TEXT DEFAULT '',
      homepage_hero_image TEXT DEFAULT '',
      about_text TEXT DEFAULT '',
      about_image TEXT DEFAULT '',
      site_settings JSONB DEFAULT '{}'::JSONB
    );

    CREATE TABLE IF NOT EXISTS contact (
      id SERIAL PRIMARY KEY,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      items JSONB DEFAULT '[]'::JSONB,
      total_price NUMERIC NOT NULL,
      status TEXT DEFAULT 'pending',
      customer_email TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      service TEXT NOT NULL,
      message TEXT DEFAULT '',
      booking_date DATE NOT NULL,
      booking_time TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      timezone TEXT DEFAULT 'Africa/Lagos',
      status TEXT DEFAULT 'pending',
      manage_token TEXT UNIQUE,
      client_notes TEXT DEFAULT '',
      internal_notes TEXT DEFAULT '',
      gallery_id INTEGER REFERENCES galleries(id) ON DELETE SET NULL,
      confirmation_sent_at TIMESTAMPTZ,
      reminder_24h_sent_at TIMESTAMPTZ,
      reminder_day_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS digital_products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price TEXT NOT NULL,
      details TEXT DEFAULT '',
      image TEXT NOT NULL,
      product_url TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      list_type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      unsubscribe_token TEXT UNIQUE NOT NULL,
      subscribed_at TIMESTAMPTZ DEFAULT NOW(),
      unsubscribed_at TIMESTAMPTZ,
      last_emailed_at TIMESTAMPTZ,
      UNIQUE(email, list_type)
    );

    CREATE TABLE IF NOT EXISTS photography_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      cover_image_url TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS photography_category_images (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES photography_categories(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      title TEXT DEFAULT '',
      alt_text TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await connection.query(`
    ALTER TABLE galleries
      ADD COLUMN IF NOT EXISTS finished_images TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS payment_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS review_rating INTEGER,
      ADD COLUMN IF NOT EXISTS review_text TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS review_featured BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS gallery_design TEXT DEFAULT 'editorial',
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS gallery_documents (
      id SERIAL PRIMARY KEY,
      gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL DEFAULT 'invoice',
      title TEXT NOT NULL,
      client_email TEXT NOT NULL,
      amount NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'NGN',
      due_date TEXT DEFAULT '',
      line_items TEXT DEFAULT '',
      terms TEXT DEFAULT '',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await connection.query(`ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`);
  await connection.query(`
    ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
    ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS billing_details JSONB;
    ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS payments JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS creation_key TEXT;
    ALTER TABLE gallery_documents ADD COLUMN IF NOT EXISTS request_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS gallery_documents_creation_key_idx ON gallery_documents (creation_key);
  `);

  await connection.query(`
    UPDATE galleries
    SET images = COALESCE(images, ARRAY[]::TEXT[]),
        approved_images = COALESCE(approved_images, ARRAY[]::TEXT[]),
        finished_images = COALESCE(finished_images, ARRAY[]::TEXT[]);
  `);

  await connection.query(`
    ALTER TABLE digital_products
      ADD COLUMN IF NOT EXISTS product_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `);

  await connection.query(`
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS booking_date DATE,
      ADD COLUMN IF NOT EXISTS booking_time TEXT,
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS manage_token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS client_notes TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS gallery_id INTEGER REFERENCES galleries(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminder_day_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_idx
      ON bookings (scheduled_at)
      WHERE status <> 'cancelled';
  `);

  await connection.query(`
    UPDATE bookings
    SET manage_token = lower(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 24))
    WHERE manage_token IS NULL OR manage_token = '';
  `);

  await connection.query(`
    ALTER TABLE photography_categories
      ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT '';
  `);

  await connection.query(`
    DELETE FROM photography_category_images a
    USING photography_category_images b
    WHERE a.id > b.id
      AND a.category_id = b.category_id
      AND a.image_url = b.image_url;

    CREATE UNIQUE INDEX IF NOT EXISTS photography_category_images_category_url_idx
      ON photography_category_images (category_id, image_url);
  `);

  await connection.query(`
    ALTER TABLE content
      ADD COLUMN IF NOT EXISTS site_settings JSONB DEFAULT '{}'::JSONB;
  `);

  // Retried creation requests return the original record instead of inserting another.
  await connection.query(`
    ALTER TABLE artworks ADD COLUMN IF NOT EXISTS creation_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS artworks_creation_key_idx ON artworks (creation_key);
    ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS creation_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS digital_products_creation_key_idx ON digital_products (creation_key);
  `);

  // seed singleton rows
  await connection.query(`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS creation_key TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS request_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_creation_key_idx ON bookings (creation_key);
  `);

  await connection.query(`INSERT INTO content (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await connection.query(`INSERT INTO contact (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
}

export async function query(text: string, params?: unknown[]) {
  await ensureTables();
  return pool.query(text, params);
}
