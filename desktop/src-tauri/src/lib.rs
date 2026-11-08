mod service;
mod employees;
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
async fn update_customer(db: State<'_, Database>, id: String, input: CustomerInput) -> Result<(), String> {
    service::update_customer(&db.0, id, input).await
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
async fn save_employee(db: State<'_, Database>, id: Option<String>, input: employees::EmployeeInput) -> Result<(), String> {
    employees::save(&db.0, id, input).await
}

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
        .invoke_handler(tauri::generate_handler![snapshot, add_customer, update_customer, add_sale, add_receipt, customer_ledger, create_backup, inspect_backup, restore_backup, list_employees, save_employee])
        .run(tauri::generate_context!())
        .expect("failed to run application");
}
