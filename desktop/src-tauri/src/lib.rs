mod service;
use service::{CustomerInput, ReceiptInput, SaleInput, Snapshot, Ledger};
use sqlx::SqlitePool;
use tauri::{Manager, State};

struct Database(SqlitePool);

#[tauri::command]
async fn add_customer(db: State<'_, Database>, input: CustomerInput) -> Result<(), String> {
    service::add_customer(&db.0, input).await
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
        .invoke_handler(tauri::generate_handler![snapshot, add_customer, add_sale, add_receipt, customer_ledger, create_backup])
        .run(tauri::generate_context!())
        .expect("failed to run application");
}
