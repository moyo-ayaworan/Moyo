export const newsletterQueueSchema = `
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
 id UUID PRIMARY KEY, request_key UUID UNIQUE NOT NULL, body_hash TEXT NOT NULL,
 subject TEXT NOT NULL, body_text TEXT NOT NULL, body_html TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS newsletter_deliveries (
 campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
 email TEXT NOT NULL, subscription_ids INTEGER[] NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 sent_at TIMESTAMPTZ, discarded BOOLEAN NOT NULL DEFAULT FALSE, failed_at TIMESTAMPTZ,
 claimed_at TIMESTAMPTZ, lease UUID, attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(campaign_id,email)
);
CREATE INDEX IF NOT EXISTS newsletter_delivery_pending_idx ON newsletter_deliveries(created_at) WHERE sent_at IS NULL AND discarded=FALSE AND failed_at IS NULL;
`;
