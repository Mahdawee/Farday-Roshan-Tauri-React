-- Period calendar is explicit; payment date is ISO Gregorian. Components are AFN cents.
CREATE TABLE salaries (
    id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    period_calendar TEXT NOT NULL CHECK(period_calendar IN ('shamsi','miladi')),
    period_year INTEGER NOT NULL CHECK(period_year >= 1 AND ((period_calendar='shamsi' AND period_year<=3177) OR (period_calendar='miladi' AND period_year<=9999))),
    period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
    pay_date TEXT NOT NULL,
    base_cents INTEGER NOT NULL CHECK(base_cents BETWEEN 0 AND 1000000000000),
    bonus_cents INTEGER NOT NULL CHECK(bonus_cents BETWEEN 0 AND 1000000000000),
    fine_cents INTEGER NOT NULL CHECK(fine_cents BETWEEN 0 AND 1000000000000),
    overtime_cents INTEGER NOT NULL CHECK(overtime_cents BETWEEN 0 AND 1000000000000),
    total_cents INTEGER NOT NULL CHECK(total_cents = base_cents + bonus_cents + overtime_cents - fine_cents),
    payer TEXT NOT NULL DEFAULT '',
    payment_type TEXT NOT NULL CHECK(payment_type IN ('cash','transfer')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX salaries_employee_idx ON salaries(employee_id);
CREATE INDEX salaries_date_idx ON salaries(pay_date DESC,id DESC);
