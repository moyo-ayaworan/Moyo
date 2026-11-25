export const adminSecuritySchema = `
CREATE TABLE IF NOT EXISTS admin_sessions (
 id UUID PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_mfa (
 id SMALLINT PRIMARY KEY CHECK(id=1), secret_encrypted TEXT NOT NULL,
 last_counter BIGINT NOT NULL DEFAULT -1, recovery_hashes TEXT[] NOT NULL,
 enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_login_challenges (
 token_hash TEXT PRIMARY KEY, secret_encrypted TEXT,
 expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
`;
