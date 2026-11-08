-- Employee records are retained when inactive; salary is integer hundredths of AFN.
CREATE TABLE employees (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    father_name TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    hire_date TEXT,
    base_salary_cents INTEGER NOT NULL DEFAULT 0 CHECK(base_salary_cents >= 0),
    phone TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX employees_status_idx ON employees(status);
