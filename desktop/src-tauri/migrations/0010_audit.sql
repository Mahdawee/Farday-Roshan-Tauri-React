-- Local experimental change journal, not a tamper-proof security audit.
-- Actor attribution is not yet available. Existing rows are not backfilled.
CREATE TABLE audit_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('insert','update','delete','restore')),
    actor TEXT,
    before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
    after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json))
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity,entity_id,sequence);
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit entries cannot be updated'); END;
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit entries cannot be deleted'); END;

CREATE TRIGGER audit_customers_insert AFTER INSERT ON customers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('customers',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'code',NEW.code,'name',NEW.name,'phone',NEW.phone,'opening_cents',NEW.opening_cents,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_customers_update AFTER UPDATE ON customers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('customers',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'code',OLD.code,'name',OLD.name,'phone',OLD.phone,'opening_cents',OLD.opening_cents,'created_at',OLD.created_at),json_object('id',NEW.id,'code',NEW.code,'name',NEW.name,'phone',NEW.phone,'opening_cents',NEW.opening_cents,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_customers_delete AFTER DELETE ON customers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('customers',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'code',OLD.code,'name',OLD.name,'phone',OLD.phone,'opening_cents',OLD.opening_cents,'created_at',OLD.created_at),NULL);
END;

CREATE TRIGGER audit_sales_insert AFTER INSERT ON sales BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sales',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'customer_id',NEW.customer_id,'sale_date',NEW.sale_date,'material',NEW.material,'volume_milli',NEW.volume_milli,'unit_price_cents',NEW.unit_price_cents,'freight_cents',NEW.freight_cents,'total_cents',NEW.total_cents,'payment_type',NEW.payment_type,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_sales_update AFTER UPDATE ON sales BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sales',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'customer_id',OLD.customer_id,'sale_date',OLD.sale_date,'material',OLD.material,'volume_milli',OLD.volume_milli,'unit_price_cents',OLD.unit_price_cents,'freight_cents',OLD.freight_cents,'total_cents',OLD.total_cents,'payment_type',OLD.payment_type,'created_at',OLD.created_at),json_object('id',NEW.id,'customer_id',NEW.customer_id,'sale_date',NEW.sale_date,'material',NEW.material,'volume_milli',NEW.volume_milli,'unit_price_cents',NEW.unit_price_cents,'freight_cents',NEW.freight_cents,'total_cents',NEW.total_cents,'payment_type',NEW.payment_type,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_sales_delete AFTER DELETE ON sales BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sales',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'customer_id',OLD.customer_id,'sale_date',OLD.sale_date,'material',OLD.material,'volume_milli',OLD.volume_milli,'unit_price_cents',OLD.unit_price_cents,'freight_cents',OLD.freight_cents,'total_cents',OLD.total_cents,'payment_type',OLD.payment_type,'created_at',OLD.created_at),NULL);
END;

CREATE TRIGGER audit_receipts_insert AFTER INSERT ON receipts BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipts',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'customer_id',NEW.customer_id,'receipt_date',NEW.receipt_date,'amount_cents',NEW.amount_cents,'source',NEW.source,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_receipts_update AFTER UPDATE ON receipts BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipts',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'customer_id',OLD.customer_id,'receipt_date',OLD.receipt_date,'amount_cents',OLD.amount_cents,'source',OLD.source,'created_at',OLD.created_at),json_object('id',NEW.id,'customer_id',NEW.customer_id,'receipt_date',NEW.receipt_date,'amount_cents',NEW.amount_cents,'source',NEW.source,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_receipts_delete AFTER DELETE ON receipts BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipts',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'customer_id',OLD.customer_id,'receipt_date',OLD.receipt_date,'amount_cents',OLD.amount_cents,'source',OLD.source,'created_at',OLD.created_at),NULL);
END;

CREATE TRIGGER audit_employees_insert AFTER INSERT ON employees BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('employees',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'code',NEW.code,'name',NEW.name,'father_name',NEW.father_name,'job_title',NEW.job_title,'hire_date',NEW.hire_date,'base_salary_cents',NEW.base_salary_cents,'phone',NEW.phone,'status',NEW.status,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_employees_update AFTER UPDATE ON employees BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('employees',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'code',OLD.code,'name',OLD.name,'father_name',OLD.father_name,'job_title',OLD.job_title,'hire_date',OLD.hire_date,'base_salary_cents',OLD.base_salary_cents,'phone',OLD.phone,'status',OLD.status,'created_at',OLD.created_at,'updated_at',OLD.updated_at),json_object('id',NEW.id,'code',NEW.code,'name',NEW.name,'father_name',NEW.father_name,'job_title',NEW.job_title,'hire_date',NEW.hire_date,'base_salary_cents',NEW.base_salary_cents,'phone',NEW.phone,'status',NEW.status,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_employees_delete AFTER DELETE ON employees BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('employees',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'code',OLD.code,'name',OLD.name,'father_name',OLD.father_name,'job_title',OLD.job_title,'hire_date',OLD.hire_date,'base_salary_cents',OLD.base_salary_cents,'phone',OLD.phone,'status',OLD.status,'created_at',OLD.created_at,'updated_at',OLD.updated_at),NULL);
END;

CREATE TRIGGER audit_expenses_insert AFTER INSERT ON expenses BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('expenses',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'expense_date',NEW.expense_date,'description',NEW.description,'expense_type',NEW.expense_type,'purchase_bill_no',NEW.purchase_bill_no,'shop_name',NEW.shop_name,'amount_afn_cents',NEW.amount_afn_cents,'amount_usd_cents',NEW.amount_usd_cents,'payer',NEW.payer,'payment_method',NEW.payment_method,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_expenses_update AFTER UPDATE ON expenses BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('expenses',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'expense_date',OLD.expense_date,'description',OLD.description,'expense_type',OLD.expense_type,'purchase_bill_no',OLD.purchase_bill_no,'shop_name',OLD.shop_name,'amount_afn_cents',OLD.amount_afn_cents,'amount_usd_cents',OLD.amount_usd_cents,'payer',OLD.payer,'payment_method',OLD.payment_method,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),json_object('id',NEW.id,'expense_date',NEW.expense_date,'description',NEW.description,'expense_type',NEW.expense_type,'purchase_bill_no',NEW.purchase_bill_no,'shop_name',NEW.shop_name,'amount_afn_cents',NEW.amount_afn_cents,'amount_usd_cents',NEW.amount_usd_cents,'payer',NEW.payer,'payment_method',NEW.payment_method,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_expenses_delete AFTER DELETE ON expenses BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('expenses',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'expense_date',OLD.expense_date,'description',OLD.description,'expense_type',OLD.expense_type,'purchase_bill_no',OLD.purchase_bill_no,'shop_name',OLD.shop_name,'amount_afn_cents',OLD.amount_afn_cents,'amount_usd_cents',OLD.amount_usd_cents,'payer',OLD.payer,'payment_method',OLD.payment_method,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),NULL);
END;

CREATE TRIGGER audit_salaries_insert AFTER INSERT ON salaries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('salaries',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'employee_id',NEW.employee_id,'period_calendar',NEW.period_calendar,'period_year',NEW.period_year,'period_month',NEW.period_month,'pay_date',NEW.pay_date,'base_cents',NEW.base_cents,'bonus_cents',NEW.bonus_cents,'fine_cents',NEW.fine_cents,'overtime_cents',NEW.overtime_cents,'total_cents',NEW.total_cents,'payer',NEW.payer,'payment_type',NEW.payment_type,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_salaries_update AFTER UPDATE ON salaries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('salaries',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'employee_id',OLD.employee_id,'period_calendar',OLD.period_calendar,'period_year',OLD.period_year,'period_month',OLD.period_month,'pay_date',OLD.pay_date,'base_cents',OLD.base_cents,'bonus_cents',OLD.bonus_cents,'fine_cents',OLD.fine_cents,'overtime_cents',OLD.overtime_cents,'total_cents',OLD.total_cents,'payer',OLD.payer,'payment_type',OLD.payment_type,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),json_object('id',NEW.id,'employee_id',NEW.employee_id,'period_calendar',NEW.period_calendar,'period_year',NEW.period_year,'period_month',NEW.period_month,'pay_date',NEW.pay_date,'base_cents',NEW.base_cents,'bonus_cents',NEW.bonus_cents,'fine_cents',NEW.fine_cents,'overtime_cents',NEW.overtime_cents,'total_cents',NEW.total_cents,'payer',NEW.payer,'payment_type',NEW.payment_type,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_salaries_delete AFTER DELETE ON salaries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('salaries',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'employee_id',OLD.employee_id,'period_calendar',OLD.period_calendar,'period_year',OLD.period_year,'period_month',OLD.period_month,'pay_date',OLD.pay_date,'base_cents',OLD.base_cents,'bonus_cents',OLD.bonus_cents,'fine_cents',OLD.fine_cents,'overtime_cents',OLD.overtime_cents,'total_cents',OLD.total_cents,'payer',OLD.payer,'payment_type',OLD.payment_type,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),NULL);
END;

CREATE TRIGGER audit_attendance_insert AFTER INSERT ON attendance BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('attendance',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'employee_id',NEW.employee_id,'work_date',NEW.work_date,'status',NEW.status,'check_in',NEW.check_in,'check_out',NEW.check_out,'overtime_hundredths',NEW.overtime_hundredths,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_attendance_update AFTER UPDATE ON attendance BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('attendance',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'employee_id',OLD.employee_id,'work_date',OLD.work_date,'status',OLD.status,'check_in',OLD.check_in,'check_out',OLD.check_out,'overtime_hundredths',OLD.overtime_hundredths,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),json_object('id',NEW.id,'employee_id',NEW.employee_id,'work_date',NEW.work_date,'status',NEW.status,'check_in',NEW.check_in,'check_out',NEW.check_out,'overtime_hundredths',NEW.overtime_hundredths,'notes',NEW.notes,'created_at',NEW.created_at,'updated_at',NEW.updated_at));
END;

CREATE TRIGGER audit_attendance_delete AFTER DELETE ON attendance BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('attendance',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'employee_id',OLD.employee_id,'work_date',OLD.work_date,'status',OLD.status,'check_in',OLD.check_in,'check_out',OLD.check_out,'overtime_hundredths',OLD.overtime_hundredths,'notes',OLD.notes,'created_at',OLD.created_at,'updated_at',OLD.updated_at),NULL);
END;

CREATE TRIGGER audit_sale_details_insert AFTER INSERT ON sale_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_details',CAST(NEW.sale_id AS TEXT),'insert',NULL,json_object('sale_id',NEW.sale_id,'bill_no',NEW.bill_no,'driver_name',NEW.driver_name,'vehicle_plate',NEW.vehicle_plate,'destination',NEW.destination,'notes',NEW.notes));
END;

CREATE TRIGGER audit_sale_details_update AFTER UPDATE ON sale_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_details',CAST(NEW.sale_id AS TEXT),'update',json_object('sale_id',OLD.sale_id,'bill_no',OLD.bill_no,'driver_name',OLD.driver_name,'vehicle_plate',OLD.vehicle_plate,'destination',OLD.destination,'notes',OLD.notes),json_object('sale_id',NEW.sale_id,'bill_no',NEW.bill_no,'driver_name',NEW.driver_name,'vehicle_plate',NEW.vehicle_plate,'destination',NEW.destination,'notes',NEW.notes));
END;

CREATE TRIGGER audit_sale_details_delete AFTER DELETE ON sale_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_details',CAST(OLD.sale_id AS TEXT),'delete',json_object('sale_id',OLD.sale_id,'bill_no',OLD.bill_no,'driver_name',OLD.driver_name,'vehicle_plate',OLD.vehicle_plate,'destination',OLD.destination,'notes',OLD.notes),NULL);
END;

CREATE TRIGGER audit_receipt_details_insert AFTER INSERT ON receipt_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_details',CAST(NEW.receipt_id AS TEXT),'insert',NULL,json_object('receipt_id',NEW.receipt_id,'related_bill_no',NEW.related_bill_no,'received_by',NEW.received_by,'notes',NEW.notes));
END;

CREATE TRIGGER audit_receipt_details_update AFTER UPDATE ON receipt_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_details',CAST(NEW.receipt_id AS TEXT),'update',json_object('receipt_id',OLD.receipt_id,'related_bill_no',OLD.related_bill_no,'received_by',OLD.received_by,'notes',OLD.notes),json_object('receipt_id',NEW.receipt_id,'related_bill_no',NEW.related_bill_no,'received_by',NEW.received_by,'notes',NEW.notes));
END;

CREATE TRIGGER audit_receipt_details_delete AFTER DELETE ON receipt_details BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_details',CAST(OLD.receipt_id AS TEXT),'delete',json_object('receipt_id',OLD.receipt_id,'related_bill_no',OLD.related_bill_no,'received_by',OLD.received_by,'notes',OLD.notes),NULL);
END;

CREATE TRIGGER audit_sale_numbers_insert AFTER INSERT ON sale_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_numbers',CAST(NEW.sale_id AS TEXT),'insert',NULL,json_object('number',NEW.number,'sale_id',NEW.sale_id));
END;

CREATE TRIGGER audit_sale_numbers_update AFTER UPDATE ON sale_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_numbers',CAST(NEW.sale_id AS TEXT),'update',json_object('number',OLD.number,'sale_id',OLD.sale_id),json_object('number',NEW.number,'sale_id',NEW.sale_id));
END;

CREATE TRIGGER audit_sale_numbers_delete AFTER DELETE ON sale_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('sale_numbers',CAST(OLD.sale_id AS TEXT),'delete',json_object('number',OLD.number,'sale_id',OLD.sale_id),NULL);
END;

CREATE TRIGGER audit_receipt_numbers_insert AFTER INSERT ON receipt_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_numbers',CAST(NEW.receipt_id AS TEXT),'insert',NULL,json_object('number',NEW.number,'receipt_id',NEW.receipt_id));
END;

CREATE TRIGGER audit_receipt_numbers_update AFTER UPDATE ON receipt_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_numbers',CAST(NEW.receipt_id AS TEXT),'update',json_object('number',OLD.number,'receipt_id',OLD.receipt_id),json_object('number',NEW.number,'receipt_id',NEW.receipt_id));
END;

CREATE TRIGGER audit_receipt_numbers_delete AFTER DELETE ON receipt_numbers BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('receipt_numbers',CAST(OLD.receipt_id AS TEXT),'delete',json_object('number',OLD.number,'receipt_id',OLD.receipt_id),NULL);
END;

CREATE TRIGGER audit_cashbox_entries_insert AFTER INSERT ON cashbox_entries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('cashbox_entries',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'entry_date',NEW.entry_date,'direction',NEW.direction,'description',NEW.description,'amount_afn_cents',NEW.amount_afn_cents,'amount_usd_cents',NEW.amount_usd_cents,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_cashbox_entries_update AFTER UPDATE ON cashbox_entries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('cashbox_entries',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'entry_date',OLD.entry_date,'direction',OLD.direction,'description',OLD.description,'amount_afn_cents',OLD.amount_afn_cents,'amount_usd_cents',OLD.amount_usd_cents,'created_at',OLD.created_at),json_object('id',NEW.id,'entry_date',NEW.entry_date,'direction',NEW.direction,'description',NEW.description,'amount_afn_cents',NEW.amount_afn_cents,'amount_usd_cents',NEW.amount_usd_cents,'created_at',NEW.created_at));
END;

CREATE TRIGGER audit_cashbox_entries_delete AFTER DELETE ON cashbox_entries BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('cashbox_entries',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'entry_date',OLD.entry_date,'direction',OLD.direction,'description',OLD.description,'amount_afn_cents',OLD.amount_afn_cents,'amount_usd_cents',OLD.amount_usd_cents,'created_at',OLD.created_at),NULL);
END;

CREATE TRIGGER audit_app_preferences_insert AFTER INSERT ON app_preferences BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('app_preferences',CAST(NEW.id AS TEXT),'insert',NULL,json_object('id',NEW.id,'calendar',NEW.calendar));
END;

CREATE TRIGGER audit_app_preferences_update AFTER UPDATE ON app_preferences BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('app_preferences',CAST(NEW.id AS TEXT),'update',json_object('id',OLD.id,'calendar',OLD.calendar),json_object('id',NEW.id,'calendar',NEW.calendar));
END;

CREATE TRIGGER audit_app_preferences_delete AFTER DELETE ON app_preferences BEGIN
    INSERT INTO audit_events(entity,entity_id,operation,before_json,after_json) VALUES('app_preferences',CAST(OLD.id AS TEXT),'delete',json_object('id',OLD.id,'calendar',OLD.calendar),NULL);
END;
