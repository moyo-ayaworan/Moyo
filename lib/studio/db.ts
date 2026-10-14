import { Pool, type PoolClient } from "pg";

// Separate schema initialization: never runs the general site's migrations.
let pool: Pool | undefined;
let initialized: Promise<void> | undefined;
function database() {
  if (!pool) {
    const value = process.env.DATABASE_URL;
    if (!value) throw Error("Studio database is not configured.");
    const url = new URL(value);
    if (url.searchParams.has("sslmode"))
      url.searchParams.set("sslmode", "verify-full");
    url.searchParams.delete("uselibpqcompat");
    pool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true },
      max: 3,
    });
  }
  return pool;
}
const schema = `
CREATE TABLE IF NOT EXISTS stillbounds_workspace (id TEXT PRIMARY KEY);
INSERT INTO stillbounds_workspace VALUES ('moyo') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS stillbounds_book_versions (
 owner_id TEXT NOT NULL REFERENCES stillbounds_workspace(id), book_id UUID NOT NULL, latest INTEGER NOT NULL,
 PRIMARY KEY(owner_id,book_id)
);
CREATE TABLE IF NOT EXISTS stillbounds_devices (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES stillbounds_workspace(id),
 token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS stillbounds_pairings (
 code_hash TEXT PRIMARY KEY, user_code TEXT UNIQUE NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL, approved BOOLEAN NOT NULL DEFAULT FALSE,
 consumed BOOLEAN NOT NULL DEFAULT FALSE, last_poll TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS stillbounds_versions (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES stillbounds_workspace(id),
 book_id UUID NOT NULL, title TEXT NOT NULL, version INTEGER NOT NULL, spread_ids JSONB NOT NULL,
 watermark BOOLEAN NOT NULL, retention_days INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'draft',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
 decision TEXT NOT NULL DEFAULT 'pending', code_hash TEXT, encrypted_code TEXT,
 gallery_id INTEGER, UNIQUE(owner_id,book_id,version)
);
CREATE TABLE IF NOT EXISTS stillbounds_media (
 version_id UUID NOT NULL REFERENCES stillbounds_versions(id) ON DELETE CASCADE,
 index INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, jpeg BYTEA NOT NULL,
 PRIMARY KEY(version_id,index)
);
CREATE TABLE IF NOT EXISTS stillbounds_comments (
 id UUID PRIMARY KEY, version_id UUID NOT NULL REFERENCES stillbounds_versions(id) ON DELETE CASCADE,
 spread_id UUID NOT NULL, text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 resolved BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS stillbounds_viewers (
 token_hash TEXT PRIMARY KEY, version_id UUID NOT NULL REFERENCES stillbounds_versions(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS stillbounds_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL, since TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS stillbounds_versions_expiry ON stillbounds_versions(expires_at);
`;
async function ready() {
  if (!initialized)
    initialized = (async () => {
      const client = await database().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(178931, 52)");
        await client.query(schema);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  await initialized;
}
export async function studioQuery(sql: string, values: unknown[] = []) {
  await ready();
  return database().query(sql, values);
}
export async function studioTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
) {
  await ready();
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
