export const commerceSchema=`
CREATE TABLE IF NOT EXISTS shop_coupons (
 id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')),
 value BIGINT NOT NULL CHECK(value>0), section TEXT CHECK(section IN ('photography','art')),
 product_id INTEGER REFERENCES digital_products(id) ON DELETE RESTRICT, minimum_kobo BIGINT NOT NULL DEFAULT 0 CHECK(minimum_kobo>=0),
 max_uses INTEGER CHECK(max_uses>0), per_email_limit INTEGER NOT NULL DEFAULT 1 CHECK(per_email_limit>0),
 starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ends_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(kind<>'percent' OR value<=99), CHECK(ends_at IS NULL OR ends_at>starts_at)
);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES shop_coupons(id) ON DELETE RESTRICT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS discount_kobo BIGINT NOT NULL DEFAULT 0 CHECK(discount_kobo>=0);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS subtotal_kobo BIGINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS coupon_reserved_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS payment_orders_coupon ON payment_orders(coupon_id,email,status,coupon_reserved_until);
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'digital' CHECK(product_kind IN ('digital','physical'));
CREATE TABLE IF NOT EXISTS shop_inventory (
 product_id INTEGER PRIMARY KEY REFERENCES digital_products(id) ON DELETE RESTRICT,
 stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK(stock_on_hand>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shop_stock_reservations (
 id UUID PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES shop_inventory(product_id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK(quantity>0), expires_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL DEFAULT 'held' CHECK(state IN ('held','committed','released')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_stock_held ON shop_stock_reservations(product_id,state,expires_at);
`;
export const shippingSchema=`
CREATE TABLE IF NOT EXISTS shop_shipping_regions (
 id UUID PRIMARY KEY,label TEXT NOT NULL,country TEXT NOT NULL CHECK(country ~ '^[A-Z]{2}$'),
 region TEXT NOT NULL DEFAULT '',fee_kobo BIGINT NOT NULL CHECK(fee_kobo>=0),
 pickup BOOLEAN NOT NULL DEFAULT FALSE,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fulfillment_kind TEXT NOT NULL DEFAULT 'digital' CHECK(fulfillment_kind IN ('digital','physical'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS stock_reservation_id UUID REFERENCES shop_stock_reservations(id) ON DELETE RESTRICT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS shipping_kobo BIGINT NOT NULL DEFAULT 0 CHECK(shipping_kobo>=0);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS shipping_details JSONB;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled','processing','ready_for_pickup','shipped','collected','cancelled'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT '';

ALTER TABLE shop_inventory ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER CHECK(low_stock_threshold BETWEEN 0 AND 1000000);
ALTER TABLE shop_inventory ADD COLUMN IF NOT EXISTS low_alerted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fulfillment_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS shop_notifications (
 id UUID PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, order_reference TEXT REFERENCES payment_orders(reference) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('fulfillment','low_stock')),payload JSONB NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,claimed_at TIMESTAMPTZ,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),sent_at TIMESTAMPTZ,discarded BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_notifications_due ON shop_notifications(next_attempt_at) WHERE sent_at IS NULL AND discarded=FALSE;
CREATE TABLE IF NOT EXISTS shop_returns (
 id UUID PRIMARY KEY,order_reference TEXT NOT NULL REFERENCES payment_orders(reference) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL CHECK(quantity>0),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','received','closed')),
 restocked_quantity INTEGER NOT NULL DEFAULT 0 CHECK(restocked_quantity>=0 AND restocked_quantity<=quantity),
 refund_kobo BIGINT NOT NULL CHECK(refund_kobo>0),refund_state TEXT NOT NULL DEFAULT 'none' CHECK(refund_state IN ('none','submitting','unknown','pending','processed','failed','needs-attention')),
 refund_reference TEXT NOT NULL UNIQUE,provider_refund_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_returns_order ON shop_returns(order_reference);
CREATE UNIQUE INDEX IF NOT EXISTS shop_returns_provider ON shop_returns(provider_refund_id) WHERE provider_refund_id IS NOT NULL;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='payment_orders'::regclass AND conname='payment_orders_fulfillment_status_check' AND pg_get_constraintdef(oid) NOT LIKE '%ready_for_pickup%') THEN
 ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_fulfillment_status_check;
 ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_fulfillment_status_check CHECK(fulfillment_status IN ('unfulfilled','processing','ready_for_pickup','shipped','collected','cancelled'));
 END IF;
END $$;
`;
