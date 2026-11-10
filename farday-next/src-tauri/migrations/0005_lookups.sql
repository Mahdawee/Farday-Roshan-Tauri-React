-- Independent lookup tables keep future foreign keys scoped to the right domain.
-- No example company data is inserted automatically.
CREATE TABLE material_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
  unit TEXT NOT NULL CHECK(length(trim(unit)) BETWEEN 1 AND 20),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN -2147483648 AND 2147483647),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE expense_types (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN -2147483648 AND 2147483647),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE payers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
  payer_kind TEXT NOT NULL CHECK(payer_kind IN ('cashbox','personal','bank','company')),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN -2147483648 AND 2147483647),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE receipt_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
  affects_balance INTEGER NOT NULL CHECK(affects_balance IN (0,1)),
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN -2147483648 AND 2147483647),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
