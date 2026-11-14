export const newsletterSchema = `
ALTER TABLE newsletter_subscribers ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE newsletter_subscribers
 ADD COLUMN IF NOT EXISTS confirmation_hash TEXT,
 ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS confirmation_requested_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_confirmation_hash_idx
 ON newsletter_subscribers(confirmation_hash) WHERE confirmation_hash IS NOT NULL;
`;
