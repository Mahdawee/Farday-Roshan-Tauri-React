-- Personnel preview. Payment and attendance transactions are not yet implemented.
CREATE TABLE employees (
  id TEXT PRIMARY KEY NOT NULL,
  emp_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  father_name TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  hire_date TEXT DEFAULT NULL,
  base_salary_minor INTEGER NOT NULL DEFAULT 0 CHECK(base_salary_minor BETWEEN -99999999999999 AND 99999999999999),
  phone TEXT NOT NULL DEFAULT '',
  tazkira_no TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contract_duration TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('active','inactive')),
  notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX employees_status_code_idx ON employees(status,emp_code);
