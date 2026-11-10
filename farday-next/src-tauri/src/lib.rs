mod company;
use sqlx::{sqlite::{SqliteConnectOptions,SqlitePoolOptions},SqlitePool};
use std::{path::PathBuf,time::Duration};
use tauri::{Manager,State};

struct Database(SqlitePool);
async fn open_database(path:PathBuf)->Result<SqlitePool,Box<dyn std::error::Error>> {
    let options=SqliteConnectOptions::new().filename(path).create_if_missing(true).foreign_keys(true).busy_timeout(Duration::from_secs(5));
    let pool=SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
    sqlx::migrate!().run(&pool).await?;Ok(pool)
}
#[tauri::command]
async fn company_snapshot(db:State<'_,Database>)->Result<company::Snapshot,String>{company::snapshot(&db.0).await}
#[tauri::command]
async fn save_company(db:State<'_,Database>,input:company::CompanyInput,revision:i64)->Result<(),String>{company::save_company(&db.0,input,revision).await}
#[tauri::command]
async fn save_machine(db:State<'_,Database>,id:Option<String>,revision:Option<i64>,input:company::MachineInput)->Result<(),String>{company::save_machine(&db.0,id,revision,input).await}
#[tauri::command]
async fn delete_machine(db:State<'_,Database>,id:String,revision:i64)->Result<(),String>{company::delete_machine(&db.0,id,revision).await}

#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default().setup(|app|{
        let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;
        let db=tauri::async_runtime::block_on(open_database(dir.join("farday-next.sqlite3")))?;
        app.manage(Database(db));Ok(())
    }).invoke_handler(tauri::generate_handler![company_snapshot,save_company,save_machine,delete_machine])
      .run(tauri::generate_context!()).expect("failed to start preview");
}
