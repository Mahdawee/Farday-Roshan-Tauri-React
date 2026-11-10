-- Opening balance is stored in hundredths, not floating point. This does not yet represent the current account balance.
CREATE TABLE customers (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  vehicle_plate TEXT NOT NULL DEFAULT '',
  opening_balance_minor INTEGER NOT NULL DEFAULT 0 CHECK(opening_balance_minor BETWEEN -9999999999999999 AND 9999999999999999),
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX customers_name_idx ON customers(name);
