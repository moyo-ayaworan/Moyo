export const paymentSchema = `
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'photography' CHECK(section IN ('photography','art'));
CREATE INDEX IF NOT EXISTS digital_products_section_idx ON digital_products(section,is_active);
CREATE TABLE IF NOT EXISTS payment_orders (
 reference TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('live','test')),
 kind TEXT NOT NULL CHECK(kind IN ('digital','invoice')), target_id INTEGER NOT NULL,
 shop_section TEXT NOT NULL DEFAULT 'photography' CHECK(shop_section IN ('photography','art')),
 document_id INTEGER REFERENCES gallery_documents(id) ON DELETE RESTRICT,
 email TEXT NOT NULL, amount_kobo BIGINT NOT NULL CHECK(amount_kobo > 0), currency TEXT NOT NULL CHECK(currency = 'NGN'),
 title TEXT NOT NULL, delivery_url TEXT NOT NULL DEFAULT '', metadata JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','review','refunded','disputed')),
 provider_id TEXT, checkout_url TEXT, request_key UUID UNIQUE, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS shop_section TEXT NOT NULL DEFAULT 'photography' CHECK(shop_section IN ('photography','art'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS pricing JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider ON payment_orders(mode, provider_id) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_invoice_pending ON payment_orders(mode,document_id) WHERE kind='invoice' AND status='pending';
CREATE TABLE IF NOT EXISTS payment_events (
 event_key TEXT PRIMARY KEY, reference TEXT NOT NULL REFERENCES payment_orders(reference), event_type TEXT NOT NULL,
 amount_kobo BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_notifications (
 reference TEXT PRIMARY KEY REFERENCES payment_orders(reference), sent_at TIMESTAMPTZ, claimed_at TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_recovery_requests (
 email_hash TEXT PRIMARY KEY, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Preserve earlier purchases, including their original amount and product metadata.
INSERT INTO payment_orders(reference,mode,kind,target_id,shop_section,email,amount_kobo,currency,title,delivery_url,metadata,status,provider_id,paid_at,created_at)
SELECT o.reference,'live','digital',o.product_id,p.section,o.customer_email,o.amount_kobo,o.currency,p.title,p.product_url,
 jsonb_build_object('product_id',o.product_id),
 CASE WHEN o.status IN ('paid','failed','refunded','disputed') THEN o.status ELSE 'pending' END,
 NULLIF(o.provider_reference,''),o.paid_at,o.created_at
FROM digital_orders o JOIN digital_products p ON p.id=o.product_id
WHERE o.currency='NGN' AND o.amount_kobo > 0
ON CONFLICT(reference) DO NOTHING;
`;
