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
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled','processing','shipped','collected','cancelled'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT '';
`;
