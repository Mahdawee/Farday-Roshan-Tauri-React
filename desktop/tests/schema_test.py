"""Smoke-test the migration with Python's built-in SQLite."""
from pathlib import Path
import sqlite3
import re
import tempfile
import unittest
SCHEMA = Path(__file__).resolve().parents[1] / 'src-tauri/migrations/0001_initial.sql'
class SchemaTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(SCHEMA.read_text())
        self.db.execute("INSERT INTO customers(id,code,name,opening_cents) VALUES('c','CUS-001','مشتری',10000)")
    def tearDown(self): self.db.close()
    def test_foreign_keys_and_validation(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','missing','2026-01-01',100,'debt')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO customers(id,code,name) VALUES('other','cus-001','duplicate')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2026-01-01',0,'debt')")
    def test_deposit_does_not_reduce_balance(self):
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2026-01-01','ماسه',1000,20000,0,20000,'credit')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2026-01-01',4000,'debt'),('r2','c','2026-01-01',5000,'deposit')")
        result = self.db.execute("SELECT c.opening_cents + COALESCE((SELECT SUM(s.total_cents) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='credit'),0) - COALESCE((SELECT SUM(r.amount_cents) FROM receipts r WHERE r.customer_id=c.id AND r.source <> 'deposit'),0) FROM customers c WHERE c.id='c'").fetchone()[0]
        self.assertEqual(result, 26000)
    def test_actual_ledger_query_excludes_cash_and_keeps_deposit(self):
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s1','c','2026-01-01','ماسه',1000,20000,0,20000,'credit'),('s2','c','2026-01-02','ریگ',1000,5000,0,5000,'cash')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2026-01-03',4000,'debt'),('r2','c','2026-01-04',5000,'deposit')")
        source = (SCHEMA.parent.parent / 'src/service.rs').read_text()
        match = re.search(r'let events = sqlx::query\("(.*?)"\)', source, re.S)
        self.assertIsNotNone(match)
        rows = self.db.execute(match.group(1), ('c', 'c')).fetchall()
        self.assertEqual([r[0] for r in rows], ['s1', 'r1', 'r2'])
        self.assertEqual([r[5] for r in rows], [1, 1, 0])
        running = 10000
        for _, _, kind, _, amount, affects, _ in rows:
            if affects: running += amount if kind == 'sale' else -amount
        self.assertEqual(running, 26000)

    def test_actual_snapshot_query(self):
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2026-01-01','ماسه',1000,20000,0,20000,'credit')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2026-01-02',5000,'deposit')")
        source = (SCHEMA.parent.parent / 'src/service.rs').read_text()
        rows = re.findall(r'let rows = sqlx::query\("(.*?)"\)', source, re.S)
        self.assertEqual(len(rows), 2)
        customers = self.db.execute(rows[0]).fetchall()
        events = self.db.execute(rows[1]).fetchall()
        self.assertEqual(customers[0][-1], 30000)
        self.assertEqual([event[0] for event in events], ['r', 's'])

    def test_vacuum_backup_query_creates_consistent_separate_snapshot(self):
        source = (SCHEMA.parent.parent / 'src/service.rs').read_text()
        self.assertIn('sqlx::query("VACUUM INTO ?")', source)
        self.db.commit()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'backup.sqlite3'
            with target.open('xb'):  # reserve without overwriting an existing file
                pass
            self.db.execute("VACUUM INTO ?", (str(target),))
            backup = sqlite3.connect(f'file:{target}?mode=ro', uri=True)
            try:
                self.assertEqual(backup.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
                self.assertEqual(backup.execute('PRAGMA foreign_key_check').fetchall(), [])
                self.db.execute("INSERT INTO customers(id,code,name) VALUES('later','C-2','later')")
                self.db.commit()
                self.assertEqual(backup.execute('SELECT COUNT(*) FROM customers').fetchone()[0], 1)
                with self.assertRaises(FileExistsError):
                    target.open('xb')
            finally:
                backup.close()

    def test_employee_migration_enforces_unique_code_and_salary(self):
        migration = SCHEMA.parent / '0002_employees.sql'
        self.db.executescript(migration.read_text())
        self.db.execute("INSERT INTO employees(id,code,name,base_salary_cents) VALUES ('e','EMP-1','کارمند',100)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO employees(id,code,name) VALUES ('e2','emp-1','تکراری')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO employees(id,code,name,base_salary_cents) VALUES ('e3','EMP-3','bad',-1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO employees(id,code,name,status) VALUES ('e4','EMP-4','bad','invalid')")

if __name__ == '__main__': unittest.main()
