-- Currencies are independent integer hundredths; no exchange rate is inferred.
CREATE TABLE expenses (
    id TEXT PRIMARY KEY NOT NULL,
    expense_date TEXT NOT NULL,
    description TEXT NOT NULL,
    expense_type TEXT NOT NULL DEFAULT '',
    purchase_bill_no TEXT NOT NULL DEFAULT '',
    shop_name TEXT NOT NULL DEFAULT '',
    amount_afn_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_afn_cents >= 0 AND amount_afn_cents <= 1000000000000),
    amount_usd_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_usd_cents >= 0 AND amount_usd_cents <= 1000000000000),
    payer TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'credit')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(amount_afn_cents > 0 OR amount_usd_cents > 0)
);
CREATE INDEX expenses_date_idx ON expenses(expense_date DESC, id DESC);
