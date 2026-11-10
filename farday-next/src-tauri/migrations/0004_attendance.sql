-- No cascaded deletion: personnel with attendance must be retained.
CREATE TABLE attendance (
  record_id TEXT NOT NULL UNIQUE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','absent','leave','sick','holiday','friday')),
  check_in TEXT DEFAULT NULL,
  check_out TEXT DEFAULT NULL,
  overtime_hundredths INTEGER NOT NULL DEFAULT 0 CHECK(overtime_hundredths BETWEEN 0 AND 99999),
  notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(employee_id, work_date)
);
CREATE INDEX attendance_date_idx ON attendance(work_date, employee_id);
