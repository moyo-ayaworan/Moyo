CREATE TABLE IF NOT EXISTS stillbounds_license_accounts (
 mode TEXT NOT NULL CHECK(mode IN ('test','live')), user_id TEXT NOT NULL,
 trial_started_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ,
 paid BOOLEAN NOT NULL DEFAULT FALSE, blocked BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(mode,user_id)
);
CREATE TABLE IF NOT EXISTS stillbounds_license_devices (
 mode TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
 activation_id UUID NOT NULL UNIQUE, device_name TEXT NOT NULL, public_key TEXT NOT NULL,
 device_key TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
 activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(mode,user_id,device_id), FOREIGN KEY(mode,user_id) REFERENCES stillbounds_license_accounts(mode,user_id)
);
CREATE TABLE IF NOT EXISTS stillbounds_license_trials (
 mode TEXT NOT NULL, device_id TEXT NOT NULL, user_id TEXT NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(mode,device_id)
);
CREATE TABLE IF NOT EXISTS stillbounds_license_challenges (
 id UUID PRIMARY KEY, mode TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
 device_name TEXT NOT NULL, public_key TEXT NOT NULL, device_key TEXT NOT NULL,
 nonce TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS stillbounds_license_orders (
 reference TEXT PRIMARY KEY, mode TEXT NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL,
 amount BIGINT NOT NULL, currency TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded','disputed')),
 provider_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), paid_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS stillbounds_license_provider_unique ON stillbounds_license_orders(mode,provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stillbounds_license_orders_user ON stillbounds_license_orders(mode,user_id);
CREATE TABLE IF NOT EXISTS stillbounds_license_events (
 event_hash TEXT PRIMARY KEY, mode TEXT NOT NULL, event_type TEXT NOT NULL, reference TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stillbounds_license_orders ADD COLUMN IF NOT EXISTS checkout_url TEXT;
ALTER TABLE stillbounds_license_events ADD COLUMN IF NOT EXISTS amount BIGINT;
