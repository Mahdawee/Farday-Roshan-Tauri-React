-- Manual cashbook. Nothing is posted automatically from sales, receipts, salaries or expenses.
CREATE TABLE cashbox_entries (
    id TEXT PRIMARY KEY NOT NULL,
    entry_date TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('in','out')),
    description TEXT NOT NULL CHECK(length(trim(description)) > 0 AND length(CAST(description AS BLOB)) <= 1000),
    amount_afn_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_afn_cents BETWEEN 0 AND 1000000000000),
    amount_usd_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_usd_cents BETWEEN 0 AND 1000000000000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(amount_afn_cents > 0 OR amount_usd_cents > 0)
);
CREATE INDEX cashbox_entries_date_idx ON cashbox_entries(entry_date DESC, created_at DESC, id DESC);
