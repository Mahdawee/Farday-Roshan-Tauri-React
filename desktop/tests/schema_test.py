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
    def test_local_user_schema_starts_empty_and_rejects_bad_roles_and_duplicates(self):
        self.db.executescript((SCHEMA.parent/'0011_local_users.sql').read_text())
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM local_users').fetchone()[0],0)
        self.db.execute("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES('u','Admin','مدیر','hash','admin')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES('u2','admin','دوم','hash','staff')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES('u3','x','دوم','hash','invalid')")
    def test_audit_records_actual_values_atomically_and_is_append_only(self):
        for file in sorted(SCHEMA.parent.glob('*.sql'))[1:]:
            self.db.executescript(file.read_text())
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM audit_events').fetchone()[0],0)
        self.db.execute("UPDATE customers SET opening_cents=25000 WHERE id='c'")
        event=self.db.execute("SELECT entity,entity_id,operation,actor,json_extract(before_json,'$.opening_cents'),json_extract(after_json,'$.opening_cents') FROM audit_events").fetchone()
        self.assertEqual(event,('customers','c','update',None,10000,25000))
        query=re.search(r'sqlx::query\("(SELECT a.sequence,.*?)"\)',(SCHEMA.parent.parent/'src/audit.rs').read_text()).group(1)
        self.db.execute("INSERT INTO audit_events(entity,entity_id,operation,actor,after_json) VALUES('authorization','wrong','insert','user',json_object('event_sequence',1,'entity','customers','operation','update'))")
        self.assertIsNone([r for r in self.db.execute(query,(50,0)).fetchall() if r[0]==1][0][5])
        self.db.execute("INSERT INTO audit_events(entity,entity_id,operation,actor,after_json) VALUES('authorization','c','insert','user',json_object('event_sequence',1,'entity','customers','operation','update'))")
        self.assertEqual([r for r in self.db.execute(query,(50,0)).fetchall() if r[0]==1][0][5],'user')
        self.db.execute('SAVEPOINT check_rollback')
        self.db.execute("UPDATE customers SET name='لغو' WHERE id='c'")
        self.db.execute('ROLLBACK TO check_rollback'); self.db.execute('RELEASE check_rollback')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM audit_events').fetchone()[0],3)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('DELETE FROM audit_events')
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE audit_events SET actor='x'")
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'cash')")
        self.db.execute("INSERT INTO sale_details(sale_id,bill_no) VALUES('s','B1')")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM audit_events WHERE entity IN ('sales','sale_details')").fetchone()[0],2)
    def test_daily_report_includes_empty_days_and_does_not_multiply_sources(self):
        for file in sorted(SCHEMA.parent.glob('*.sql'))[1:]: self.db.executescript(file.read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')")
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s1','c','2024-02-28','x',1000,100,0,100,'cash'),('s2','c','2024-02-28','x',2000,100,0,200,'credit'),('outside','c','2024-03-02','x',1000,100,0,100,'cash')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2024-02-28',200,'debt'),('r2','c','2024-02-28',300,'deposit')")
        self.db.execute("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES('x','2024-03-01','x',120,340,'credit')")
        self.db.execute("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('p','e','miladi',2024,2,'2024-03-01',100,0,300,0,-200,'transfer')")
        source=(SCHEMA.parent.parent/'src/reports.rs').read_text()
        query=re.search(r'const DAILY_SQL:&str = "(.*?)";',source,re.S).group(1)
        self.db.row_factory=sqlite3.Row
        rows=self.db.execute(query,('2024-02-28','2024-03-01')).fetchall()
        self.assertEqual([r['date'] for r in rows],['2024-02-28','2024-02-29','2024-03-01'])
        self.assertEqual((rows[0]['sales_count'],rows[0]['sales_cash'],rows[0]['sales_credit'],rows[0]['volume'],rows[0]['receipts_effective'],rows[0]['receipts_deposit']),(2,100,200,3000,200,300))
        self.assertEqual((rows[1]['sales_count'],rows[1]['receipts_count'],rows[1]['expenses_count']), (0,0,0))
        self.assertEqual((rows[2]['expenses_afn'],rows[2]['expenses_usd'],rows[2]['salaries_afn']),(120,340,-200))

    def test_transaction_actor_markers_cover_multiple_trigger_events_and_rollback(self):
        for file in sorted(SCHEMA.parent.glob('*.sql'))[1:]:
            self.db.executescript(file.read_text())
        source=(SCHEMA.parent.parent/'src/authorized_transactions.rs').read_text()
        query=re.search(r'sqlx::query\("(INSERT INTO audit_events\(entity,entity_id,operation,actor,after_json\) SELECT .*?)"\)',source).group(1)
        self.db.execute('SAVEPOINT protected')
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'cash')")
        self.db.execute("INSERT INTO sale_details(sale_id,bill_no) VALUES('s','B1')")
        self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('s')")
        self.db.execute(query,('actor',0))
        events=self.db.execute("SELECT entity,entity_id,sequence FROM audit_events WHERE entity<>'authorization' ORDER BY sequence").fetchall()
        markers=self.db.execute("SELECT json_extract(after_json,'$.entity'),entity_id,json_extract(after_json,'$.event_sequence'),actor FROM audit_events WHERE entity='authorization' ORDER BY sequence").fetchall()
        self.assertEqual(len(events),3)
        self.assertEqual(markers,[(entity,id,seq,'actor') for entity,id,seq in events])
        self.db.execute('ROLLBACK TO protected');self.db.execute('RELEASE protected')
        for table in ('sales','sale_details','sale_numbers','audit_events'):
            self.assertEqual(self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0],0)

    def test_attendance_compare_and_swap_uses_null_safe_times(self):
        for file in ['0002_employees.sql','0005_attendance.sql']:
            self.db.executescript((SCHEMA.parent / file).read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')")
        self.db.execute("INSERT INTO attendance(id,employee_id,work_date,status,overtime_hundredths) VALUES('a','e','2025-03-21','present',100)")
        source=(SCHEMA.parent.parent / 'src/attendance.rs').read_text()
        query=re.search(r'sqlx::query\("(UPDATE attendance SET .*?)"\)',source).group(1)
        old=('a','e','2025-03-21','present',None,None,100,'')
        win=('e','2025-03-21','leave','08:30',None,100,'')
        self.assertEqual(self.db.execute(query,win+old).rowcount,1)
        self.assertEqual(self.db.execute(query,('e','2025-03-21','present',None,None,200,'stale')+old).rowcount,0)
        self.assertEqual(self.db.execute("SELECT status,check_in,overtime_hundredths FROM attendance WHERE id='a'").fetchone(),('leave','08:30',100))
    def test_employee_compare_and_swap_null_date_and_binary_code(self):
        self.db.executescript((SCHEMA.parent / '0002_employees.sql').read_text())
        self.db.execute("INSERT INTO employees(id,code,name,base_salary_cents) VALUES('e','EMP','کارمند',10000)")
        source=(SCHEMA.parent.parent / 'src/employees.rs').read_text()
        query=re.search(r'sqlx::query\("(UPDATE employees SET .*?)"\)',source).group(1)
        original=('e','EMP','کارمند','','',None,10000,'','active')
        case_only=('emp','کارمند','','',None,10000,'','active')
        self.assertEqual(self.db.execute(query,case_only+original).rowcount,1)
        self.assertEqual(self.db.execute(query,('EMP','کارمند','','',None,20000,'','active')+original).rowcount,0)
        current=('e','emp','کارمند','','',None,10000,'','active')
        self.assertEqual(self.db.execute(query,('emp','کارمند','','','2025-01-01',20000,'','active')+current).rowcount,1)
        self.assertEqual(self.db.execute(query,case_only+current).rowcount,0)
        self.assertEqual(self.db.execute("SELECT hire_date,base_salary_cents FROM employees WHERE id='e'").fetchone(),('2025-01-01',20000))
    def test_customer_edit_compare_uses_binary_code_and_preserves_ledger(self):
        source=(SCHEMA.parent.parent / 'src/service.rs').read_text()
        query=re.search(r'sqlx::query\("(UPDATE customers SET .*?)"\)',source).group(1)
        previous=('c','CUS-001','مشتری','',10000)
        update=('cus-001','مشتری','',10000)
        self.assertEqual(self.db.execute(query,update+previous).rowcount,1)
        self.assertEqual(self.db.execute(query,('CUS-001','مشتری','',20000)+previous).rowcount,0)
        self.assertEqual(self.db.execute("SELECT code,opening_cents FROM customers WHERE id='c'").fetchone(),('cus-001',10000))
    def test_salary_edit_uses_atomic_compare_and_swap(self):
        for file in ['0002_employees.sql','0004_salaries.sql']:
            self.db.executescript((SCHEMA.parent / file).read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')")
        self.db.execute("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payer,payment_type,notes) VALUES('p','e','shamsi',1404,1,'2025-03-21',100,0,0,0,100,'','cash','اول')")
        source=(SCHEMA.parent.parent / 'src/salaries.rs').read_text()
        query=re.search(r'sqlx::query\("(UPDATE salaries SET .*?)"\)',source).group(1)
        previous=('p','e','shamsi',1404,1,'2025-03-21',100,0,0,0,100,'','cash','اول')
        update=('e','shamsi',1404,1,'2025-03-21',100,0,200,0,-100,'','cash','دوم')
        self.assertEqual(self.db.execute(query,update+previous).rowcount,1)
        self.assertEqual(self.db.execute(query,update+previous).rowcount,0)
        self.assertEqual(self.db.execute("SELECT notes,total_cents FROM salaries WHERE id='p'").fetchone(),('دوم',-100))
    def test_expense_edit_uses_atomic_compare_and_swap(self):
        self.db.executescript((SCHEMA.parent / '0003_expenses.sql').read_text())
        self.db.execute("INSERT INTO expenses(id,expense_date,description,expense_type,purchase_bill_no,shop_name,amount_afn_cents,amount_usd_cents,payer,payment_method,notes) VALUES('x','2025-01-01','تیل','سوخت','B','دوکان',120,340,'علی','cash','اول')")
        source=(SCHEMA.parent.parent / 'src/expenses.rs').read_text()
        query=re.search(r'sqlx::query\("(UPDATE expenses SET .*?)"\)',source).group(1)
        previous=('x','2025-01-01','تیل','سوخت','B','دوکان',120,340,'علی','cash','اول')
        update=('2025-01-01','تیل','سوخت','B','دوکان',120,340,'علی','cash','دوم')
        self.assertEqual(self.db.execute(query,update+previous).rowcount,1)
        self.assertEqual(self.db.execute(query,update+previous).rowcount,0)
        self.assertEqual(self.db.execute("SELECT notes FROM expenses WHERE id='x'").fetchone()[0],'دوم')
    def test_calendar_preference_migration_is_singleton_and_validated(self):
        self.db.executescript((SCHEMA.parent / '0009_preferences.sql').read_text())
        self.assertEqual(self.db.execute("SELECT id,calendar FROM app_preferences").fetchall(), [(1,'shamsi')])
        self.db.execute("UPDATE app_preferences SET calendar='miladi' WHERE id=1")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE app_preferences SET calendar='other'")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO app_preferences VALUES(2,'shamsi')")
        self.assertEqual(self.db.execute("SELECT calendar FROM app_preferences").fetchone()[0], 'miladi')
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
        self.db.executescript((SCHEMA.parent / '0007_document_numbers.sql').read_text())
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s1','c','2026-01-01','ماسه',1000,20000,0,20000,'credit'),('s2','c','2026-01-02','ریگ',1000,5000,0,5000,'cash')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2026-01-03',4000,'debt'),('r2','c','2026-01-04',5000,'deposit')")
        self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('s1')")
        self.db.execute("INSERT INTO receipt_numbers(receipt_id) VALUES('r1'),('r2')")
        source = (SCHEMA.parent.parent / 'src/service.rs').read_text()
        match = re.search(r'let events = sqlx::query\("(.*?)"\)', source, re.S)
        self.assertIsNotNone(match)
        rows = self.db.execute(match.group(1), ('c', 'c')).fetchall()
        self.assertEqual([r[0] for r in rows], ['s1', 'r1', 'r2'])
        self.assertEqual([r[5] for r in rows], [1, 1, 0])
        running = 10000
        self.assertEqual([r[7] for r in rows], ['S-000001', 'R-000001', 'R-000002'])
        for _, _, kind, _, amount, affects, _, _ in rows:
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

    def test_transaction_edit_sql_cas_and_foreign_key(self):
        self.db.execute("INSERT INTO customers(id,code,name) VALUES('c2','C2','دوم')")
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2026-01-01','ریگ',1000,20000,0,20000,'credit')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c2','2026-01-02',5000,'deposit')")
        source = (SCHEMA.parent.parent / 'src/service.rs').read_text()
        sale = re.search(r'sqlx::query\("(UPDATE sales SET .*?)"\)', source).group(1)
        receipt = re.search(r'sqlx::query\("(UPDATE receipts SET .*?)"\)', source).group(1)
        old_sale = ('s','c','2026-01-01','ریگ',1000,20000,0,20000,'credit')
        new_sale = ('c2','2026-01-01','ریگ',1000,30000,0,30000,'credit')
        self.assertEqual(self.db.execute(sale, new_sale + old_sale).rowcount, 1)
        self.assertEqual(self.db.execute(sale, new_sale + old_sale).rowcount, 0)
        old_receipt = ('r','c2','2026-01-02',5000,'deposit')
        new_receipt = ('c2','2026-01-02',5000,'debt')
        self.assertEqual(self.db.execute(receipt, new_receipt + old_receipt).rowcount, 1)
        self.assertEqual(self.db.execute(receipt, new_receipt + old_receipt).rowcount, 0)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sale, ('missing',) + new_sale[1:] + ('s',) + new_sale)
        rows = re.findall(r'let rows = sqlx::query\("(.*?)"\)', source, re.S)
        balances = {row[0]: row[-1] for row in self.db.execute(rows[0]).fetchall()}
        self.assertEqual(balances, {'c': 10000, 'c2': 25000})
        self.assertEqual(self.db.execute("SELECT customer_id,total_cents FROM sales WHERE id='s'").fetchone(), ('c2',30000))

    def test_financial_report_actual_sql_uses_complete_inclusive_history(self):
        for migration in ['0002_employees.sql','0003_expenses.sql','0004_salaries.sql']:
            self.db.executescript((SCHEMA.parent / migration).read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')")
        self.db.executemany("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES(?,'c','2025-03-21','ریگ',1000,100,0,100,'credit')", [(str(i),) for i in range(105)])
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('cash','c','2025-03-22','ریگ',1250,100,0,125,'cash'),('outside','c','2025-03-23','ریگ',1000,100,0,100,'credit')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2025-03-21',200,'debt'),('r2','c','2025-03-22',300,'deposit')")
        self.db.execute("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES('x','2025-03-21','x',120,340,'credit')")
        self.db.execute("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('p','e','shamsi',1404,1,'2025-03-22',100,0,300,0,-200,'transfer')")
        source = (SCHEMA.parent.parent / 'src/reports.rs').read_text()
        query = re.search(r'const SUMMARY_SQL: &str = "(.*?)";',source,re.S).group(1)
        self.assertEqual(self.db.execute(query,('2025-03-21','2025-03-22')).fetchone(),(106,125,10500,106250,2,200,300,1,120,340,1,-200))
        self.assertEqual(self.db.execute(query,('2024-01-01','2024-01-01')).fetchone(),(0,0,0,0,0,0,0,0,0,0,0,0))

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

    def test_expenses_migration_separates_currencies_and_requires_positive_amount(self):
        self.db.executescript((SCHEMA.parent / '0003_expenses.sql').read_text())
        self.db.execute("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES ('x','2026-01-01','تیل',10050,525,'cash')")
        self.assertEqual(self.db.execute("SELECT amount_afn_cents,amount_usd_cents FROM expenses").fetchone(), (10050,525))
        for afn, usd, method in [(0,0,'cash'),(-1,100,'cash'),(1000000000001,0,'cash'),(100,0,'invalid')]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES ('bad','2026-01-01','x',?,?,?)", (afn,usd,method))

    def test_salary_migration_enforces_foreign_keys_period_and_exact_total(self):
        self.db.executescript((SCHEMA.parent / '0002_employees.sql').read_text())
        self.db.executescript((SCHEMA.parent / '0004_salaries.sql').read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')")
        query = "INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES (?,?,?,?,?,'2025-03-21',10050,1025,500,100,?,?)"
        self.db.execute(query, ('s','e','shamsi',1404,1,10675,'cash'))
        for args in [('bad','missing','shamsi',1404,1,10675,'cash'),('bad','e','shamsi',3178,1,10675,'cash'),('bad','e','miladi',2025,13,10675,'cash'),('bad','e','miladi',2025,1,0,'cash'),('bad','e','miladi',2025,1,10675,'invalid')]:
            with self.assertRaises(sqlite3.IntegrityError): self.db.execute(query,args)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("DELETE FROM employees WHERE id='e'")

    def test_attendance_migration_enforces_unique_day_employee_and_values(self):
        self.db.executescript((SCHEMA.parent / '0002_employees.sql').read_text())
        self.db.executescript((SCHEMA.parent / '0005_attendance.sql').read_text())
        self.db.execute("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')")
        self.db.execute("INSERT INTO attendance(id,employee_id,work_date,status,overtime_hundredths) VALUES ('a','e','2025-03-21','present',125)")
        for args in [('a2','e','2025-03-21','absent',0),('a2','missing','2025-03-22','present',0),('a2','e','2025-03-22','invalid',0),('a2','e','2025-03-22','present',-1),('a2','e','2025-03-22','present',100000)]:
            with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO attendance(id,employee_id,work_date,status,overtime_hundredths) VALUES (?,?,?,?,?)",args)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("DELETE FROM employees WHERE id='e'")

    def test_supplemental_transaction_details_constraints(self):
        self.db.executescript((SCHEMA.parent / '0006_transaction_details.sql').read_text())
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'credit')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2025-01-01',100,'debt')")
        self.db.execute("INSERT INTO sale_details(sale_id,bill_no) VALUES('s','BL-1')")
        self.db.execute("INSERT INTO receipt_details(receipt_id,received_by) VALUES('r','احمد')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO sale_details(sale_id) VALUES('missing')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE sale_details SET bill_no=? WHERE sale_id='s'",('الف'*81,))
        self.db.execute("DELETE FROM sales WHERE id='s'")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM sale_details").fetchone()[0],0)

    def test_manual_cashbook_validates_positive_separate_currencies(self):
        self.db.executescript((SCHEMA.parent / '0008_cashbox.sql').read_text())
        query="INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents,amount_usd_cents) VALUES(?,?,?,?,?,?)"
        self.db.execute(query,('m','2025-01-01','in','مانده',120,50))
        for args in [('n','2025-01-01','in','x',0,0),('n','2025-01-01','in','x',-1,5),('n','2025-01-01','invalid','x',1,0),('n','2025-01-01','in',' ',1,0)]:
            with self.assertRaises(sqlite3.IntegrityError): self.db.execute(query,args)

    def test_local_document_numbers_upgrade_and_never_reuse_deleted_values(self):
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type,created_at) VALUES('b','c','2025-01-01','ریگ',1000,100,0,100,'cash','2025-01-02'),('a','c','2025-01-01','ریگ',1000,100,0,100,'cash','2025-01-01')")
        self.db.execute("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2025-01-01',100,'debt')")
        self.db.executescript((SCHEMA.parent / '0007_document_numbers.sql').read_text())
        self.assertEqual(self.db.execute("SELECT sale_id,number FROM sale_numbers ORDER BY number").fetchall(), [('a',1),('b',2)])
        self.assertEqual(self.db.execute("SELECT number FROM receipt_numbers").fetchone()[0],1)
        self.db.execute("DELETE FROM sales WHERE id='b'")
        self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('n','c','2025-01-01','ریگ',1000,100,0,100,'cash')")
        self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('n')")
        self.assertEqual(self.db.execute("SELECT number FROM sale_numbers WHERE sale_id='n'").fetchone()[0],3)
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('missing')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('n')")

    def test_actual_paged_transaction_sql_searches_all_records_literally(self):
        self.db.executescript((SCHEMA.parent / '0006_transaction_details.sql').read_text())
        self.db.executescript((SCHEMA.parent / '0007_document_numbers.sql').read_text())
        source=(SCHEMA.parent.parent / 'src/transactions.rs').read_text()
        sale=re.search(r'"sale" => "(.*?)",',source,re.S).group(1)
        where=re.search(r'let where_clause = "(.*?)";',source,re.S).group(1)
        for i in range(130):
            self.db.execute("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES(?, 'c', ?, ?,1000,100,0,100,'credit')", (f's{i:03}', '2024-01-01' if i<25 else '2026-01-01', 'ویژه %' if i==0 else 'ریگ'))
        self.db.execute("INSERT INTO sale_details(sale_id,bill_no,driver_name) VALUES('s000','BL-007','راننده خاص')")
        self.db.execute("INSERT INTO sale_numbers(sale_id) VALUES('s000')")
        count=f"WITH records AS ({sale}) SELECT COUNT(*) FROM records{where}"
        page=f"WITH records AS ({sale}) SELECT id FROM records{where} ORDER BY date DESC,created_at DESC,id DESC LIMIT ?6 OFFSET ?7"
        self.assertEqual(self.db.execute(count,(None,None,'',None,None)).fetchone()[0],130)
        self.assertEqual(len(self.db.execute(page,(None,None,'',None,None,25,125)).fetchall()),5)
        self.assertEqual(self.db.execute(count,(None,None,'%',None,None)).fetchone()[0],1)
        self.assertEqual(self.db.execute(count,(None,None,'s-000001',None,None)).fetchone()[0],1)
        self.assertEqual(self.db.execute(count,(None,None,'bl-007',None,None)).fetchone()[0],1)
        self.assertEqual(self.db.execute(count,(None,None,'راننده خاص',None,None)).fetchone()[0],1)
        self.assertEqual(self.db.execute(count,(None,None,'','c','credit')).fetchone()[0],130)
        self.assertEqual(self.db.execute(count,(None,None,'','c','cash')).fetchone()[0],0)
        self.assertEqual(self.db.execute(count,('2024-01-01','2024-01-01','',None,None)).fetchone()[0],25)

if __name__ == '__main__': unittest.main()
