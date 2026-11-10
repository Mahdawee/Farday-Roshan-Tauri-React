-- Independent preview database. Actor attribution and access control are not yet active.
CREATE TABLE company (
    id INTEGER PRIMARY KEY CHECK(id=1),
    name TEXT NOT NULL, activity_type TEXT NOT NULL, address TEXT NOT NULL,
    finance_manager TEXT NOT NULL, supervisor TEXT NOT NULL, fiscal_year_note TEXT NOT NULL,
    employees_count INTEGER NOT NULL CHECK(employees_count BETWEEN 0 AND 2147483647),
    phone TEXT NOT NULL, email TEXT NOT NULL, license_no TEXT NOT NULL, notes TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO company(id,name,activity_type,address,finance_manager,supervisor,fiscal_year_note,employees_count,phone,email,license_no,notes)
VALUES(1,'شرکت فردای روشن','تولید مواد ساختمانی','','','','',0,'','','','');
CREATE TABLE machines (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL, count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 2147483647),
    status TEXT NOT NULL CHECK(status IN ('active','inactive','repair')),
    notes TEXT NOT NULL, sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN -2147483648 AND 2147483647),
    revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE INDEX machines_sort_idx ON machines(sort_order,id);
