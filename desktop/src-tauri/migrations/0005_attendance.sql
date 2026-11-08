-- One record per employee and Gregorian day; overtime is hundredths of an hour.
CREATE TABLE attendance (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    work_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('present','absent','leave','sick','holiday','friday')),
    check_in TEXT,
    check_out TEXT,
    overtime_hundredths INTEGER NOT NULL DEFAULT 0 CHECK(overtime_hundredths BETWEEN 0 AND 99999),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, work_date)
);
CREATE INDEX attendance_date_idx ON attendance(work_date DESC, id DESC);
