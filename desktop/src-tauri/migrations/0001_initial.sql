-- All monetary values are integer hundredths of an afghani; volume is in thousandths.
CREATE TABLE customers (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    opening_cents INTEGER NOT NULL DEFAULT 0 CHECK(opening_cents >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sales (
    id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_date TEXT NOT NULL,
    material TEXT NOT NULL,
    volume_milli INTEGER NOT NULL CHECK(volume_milli > 0),
    unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
    freight_cents INTEGER NOT NULL CHECK(freight_cents >= 0),
    total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
    payment_type TEXT NOT NULL CHECK(payment_type IN ('cash', 'credit')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sales_customer_idx ON sales(customer_id);
CREATE TABLE receipts (
    id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    receipt_date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    source TEXT NOT NULL CHECK(source IN ('debt', 'deposit', 'statement', 'advance')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX receipts_customer_idx ON receipts(customer_id);
