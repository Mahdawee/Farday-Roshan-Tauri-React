-- Preview only. No authentication, audit, accounting approval or receipt integration yet.
CREATE TABLE sales_counters (
  year INTEGER PRIMARY KEY CHECK(year BETWEEN 1 AND 9999),
  last_number INTEGER NOT NULL CHECK(last_number BETWEEN 1 AND 999999999)
);
CREATE TABLE sales (
  id TEXT PRIMARY KEY NOT NULL,
  sale_no TEXT NOT NULL UNIQUE,
  sale_date TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  material_id TEXT NOT NULL REFERENCES material_types(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL DEFAULT '', driver_name TEXT NOT NULL DEFAULT '',
  vehicle_plate TEXT NOT NULL DEFAULT '', destination TEXT NOT NULL DEFAULT '', related_to TEXT NOT NULL DEFAULT '',
  volume_milli INTEGER NOT NULL CHECK(volume_milli BETWEEN -999999999999 AND 999999999999),
  unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor BETWEEN -99999999999999 AND 99999999999999),
  freight_minor INTEGER NOT NULL CHECK(freight_minor BETWEEN -99999999999999 AND 99999999999999),
  total_minor INTEGER NOT NULL CHECK(total_minor BETWEEN -9999999999999999 AND 9999999999999999),
  payment_type TEXT NOT NULL CHECK(payment_type IN ('cash','credit')),
  notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sales_date_idx ON sales(sale_date DESC,id);
CREATE INDEX sales_customer_idx ON sales(customer_id);
CREATE INDEX sales_material_idx ON sales(material_id);
