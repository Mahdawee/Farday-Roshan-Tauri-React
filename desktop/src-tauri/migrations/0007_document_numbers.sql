-- Local experimental identifiers, not the legacy annual or official document series.
-- AUTOINCREMENT reserves committed numbers on a single SQLite database.
CREATE TABLE sale_numbers (
    number INTEGER PRIMARY KEY AUTOINCREMENT CHECK(number BETWEEN 1 AND 9000000000000000),
    sale_id TEXT NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE
);
CREATE TABLE receipt_numbers (
    number INTEGER PRIMARY KEY AUTOINCREMENT CHECK(number BETWEEN 1 AND 9000000000000000),
    receipt_id TEXT NOT NULL UNIQUE REFERENCES receipts(id) ON DELETE CASCADE
);
-- Assign deterministic local numbers to existing records during upgrade.
INSERT INTO sale_numbers(sale_id) SELECT id FROM sales ORDER BY created_at,id;
INSERT INTO receipt_numbers(receipt_id) SELECT id FROM receipts ORDER BY created_at,id;
