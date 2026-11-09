mod service;
mod employees;
mod expenses;
mod salaries;
mod attendance;
mod transactions;
mod reports;
mod grouped_reports;
mod cashbox;
mod preferences;
mod restore;
use service::{CustomerInput, ReceiptInput, SaleInput, Snapshot, Ledger};
use sqlx::SqlitePool;
use tauri::{Manager, State};

struct Database(SqlitePool);

#[tauri::command]
async fn add_customer(db: State<'_, Database>, input: CustomerInput) -> Result<(), String> {
    service::add_customer(&db.0, input).await
}
#[tauri::command]
async fn update_customer(db: State<'_, Database>, id: String, input: CustomerInput, expected: CustomerInput) -> Result<(), String> {
    service::update_customer(&db.0, id, input, expected).await
}
#[tauri::command]
async fn add_sale(db: State<'_, Database>, input: SaleInput) -> Result<(), String> {
    service::add_sale(&db.0, input).await
}
#[tauri::command]
async fn add_receipt(db: State<'_, Database>, input: ReceiptInput) -> Result<(), String> {
    service::add_receipt(&db.0, input).await
}
#[tauri::command]
async fn update_sale(db: State<'_, Database>, id: String, input: SaleInput, expected: SaleInput) -> Result<(), String> { service::update_sale(&db.0,id,input,expected).await }
#[tauri::command]
async fn update_receipt(db: State<'_, Database>, id: String, input: ReceiptInput, expected: ReceiptInput) -> Result<(), String> { service::update_receipt(&db.0,id,input,expected).await }
#[tauri::command]
async fn snapshot(db: State<'_, Database>) -> Result<Snapshot, String> {
    service::snapshot(&db.0).await
}

#[tauri::command]
async fn customer_ledger(db: State<'_, Database>, customer_id: String) -> Result<Ledger, String> {
    service::customer_ledger(&db.0, customer_id).await
}

#[tauri::command]
async fn create_backup(db: State<'_, Database>, path: String) -> Result<(), String> {
    service::create_backup(&db.0, std::path::PathBuf::from(path)).await
}

#[tauri::command]
async fn inspect_backup(db: State<'_, Database>, path: String) -> Result<restore::BackupInfo, String> {
    restore::inspect(&db.0, std::path::PathBuf::from(path)).await
}

#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, db: State<'_, Database>, path: String) -> Result<restore::RestoreResult, String> {
    let dir = app.path().app_data_dir().map_err(|_| "مسیر دادهٔ برنامه یافت نشد.")?.join("restore-safety");
    restore::restore(&db.0, std::path::PathBuf::from(path), dir).await
}

#[tauri::command]
async fn list_employees(db: State<'_, Database>) -> Result<Vec<employees::Employee>, String> {
    employees::list(&db.0).await
}
#[tauri::command]
async fn save_employee(db: State<'_, Database>, id: Option<String>, input: employees::EmployeeInput, expected: Option<employees::EmployeeInput>) -> Result<(), String> {
    employees::save(&db.0, id, input, expected).await
}

#[tauri::command]
async fn list_expenses(db: State<'_, Database>) -> Result<Vec<expenses::Expense>, String> { expenses::list(&db.0).await }
#[tauri::command]
async fn save_expense(db: State<'_, Database>, id: Option<String>, input: expenses::ExpenseInput, expected: Option<expenses::ExpenseInput>) -> Result<(), String> { expenses::save(&db.0, id, input, expected).await }

#[tauri::command]
async fn list_salaries(db: State<'_, Database>) -> Result<Vec<salaries::Salary>, String> { salaries::list(&db.0).await }
#[tauri::command]
async fn save_salary(db: State<'_, Database>, id: Option<String>, input: salaries::SalaryInput, expected: Option<salaries::SalaryInput>) -> Result<(), String> { salaries::save(&db.0, id, input, expected).await }

#[tauri::command]
async fn list_attendance(db: State<'_, Database>) -> Result<Vec<attendance::Attendance>, String> { attendance::list(&db.0).await }
#[tauri::command]
async fn save_attendance(db: State<'_, Database>, id: Option<String>, input: attendance::AttendanceInput) -> Result<(), String> { attendance::save(&db.0, id, input).await }

#[tauri::command]
async fn create_attendance_batch(db: State<'_, Database>, work_date: String, rows: Vec<attendance::BatchRow>) -> Result<(), String> { attendance::create_batch(&db.0, work_date, rows).await }

#[tauri::command]
async fn list_transactions(db: State<'_, Database>, query: transactions::TransactionQuery) -> Result<transactions::TransactionPage, String> { transactions::list(&db.0, query).await }

#[tauri::command]
async fn transaction_detail(db: State<'_, Database>, kind: String, id: String) -> Result<transactions::TransactionDetail, String> { transactions::detail(&db.0, kind, id).await }

#[tauri::command]
async fn range_summary(db: State<'_, Database>, from: String, to: String) -> Result<reports::RangeSummary, String> { reports::range_summary(&db.0, from, to).await }

#[tauri::command]
async fn grouped_report(db: State<'_, Database>, from: String, to: String) -> Result<grouped_reports::GroupedReport, String> { grouped_reports::grouped(&db.0, from, to).await }

#[tauri::command]
async fn export_grouped_csv(db: State<'_, Database>, from: String, to: String, expected: grouped_reports::GroupedReport, path: String) -> Result<(), String> { grouped_reports::export_csv(&db.0,from,to,expected,std::path::Path::new(&path)).await }

#[tauri::command]
async fn export_range_csv(db: State<'_, Database>, from: String, to: String, expected: reports::RangeSummary, path: String) -> Result<(), String> { reports::export_csv(&db.0, from, to, expected, std::path::Path::new(&path)).await }

#[tauri::command]
async fn get_calendar_preference(db: State<'_, Database>) -> Result<String,String> {preferences::calendar(&db.0).await}
#[tauri::command]
async fn set_calendar_preference(db: State<'_, Database>, value:String) -> Result<(),String> {preferences::set_calendar(&db.0,value).await}

#[tauri::command]
async fn cashbox_page(db: State<'_, Database>, query: cashbox::CashboxQuery) -> Result<cashbox::CashboxPage,String> {cashbox::page(&db.0,query).await}
#[tauri::command]
async fn add_cashbox_entry(db: State<'_, Database>, input: cashbox::CashboxInput) -> Result<(),String> {cashbox::add(&db.0,input).await}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let pool = tauri::async_runtime::block_on(service::open_database(dir.join("farday-roshan.sqlite3")))?;
            app.manage(Database(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![snapshot, add_customer, update_customer, add_sale, add_receipt, update_sale, update_receipt, customer_ledger, create_backup, inspect_backup, restore_backup, list_employees, save_employee, list_expenses, save_expense, list_salaries, save_salary, list_attendance, save_attendance, create_attendance_batch, list_transactions, transaction_detail, range_summary, grouped_report, export_grouped_csv, export_range_csv, get_calendar_preference, set_calendar_preference, cashbox_page, add_cashbox_entry])
        .run(tauri::generate_context!())
        .expect("failed to run application");
}
