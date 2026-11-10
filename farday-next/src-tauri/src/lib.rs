mod company;
mod customers;
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

#[tauri::command]
async fn list_customers(db:State<'_,Database>)->Result<Vec<customers::Customer>,String>{customers::list(&db.0).await}
#[tauri::command]
async fn save_customer(db:State<'_,Database>,id:Option<String>,revision:Option<i64>,input:customers::CustomerInput)->Result<(),String>{customers::save(&db.0,id,revision,input).await}
#[tauri::command]
async fn delete_customer(db:State<'_,Database>,id:String,revision:i64)->Result<(),String>{customers::delete(&db.0,id,revision).await}

#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default().setup(|app|{
        let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;
        let db=tauri::async_runtime::block_on(open_database(dir.join("farday-next.sqlite3")))?;
        app.manage(Database(db));Ok(())
    }).invoke_handler(tauri::generate_handler![company_snapshot,save_company,save_machine,delete_machine,list_customers,save_customer,delete_customer])
      .run(tauri::generate_context!()).expect("failed to start preview");
}

#[cfg(test)]
mod migration_tests {
    use super::*;
    use sqlx::migrate::{Migrate,Migrator};
    static MIGRATIONS:Migrator=sqlx::migrate!();
    #[tokio::test]
    async fn upgrading_company_database_preserves_existing_data() {
        let path=std::env::temp_dir().join(format!("farday-upgrade-{}.sqlite3",uuid::Uuid::new_v4()));
        let options=SqliteConnectOptions::new().filename(&path).create_if_missing(true);
        let pool=SqlitePoolOptions::new().max_connections(1).connect_with(options).await.unwrap();
        {
            let mut conn=pool.acquire().await.unwrap();
            conn.ensure_migrations_table().await.unwrap();
            conn.apply(MIGRATIONS.iter().find(|m|m.version==1).unwrap()).await.unwrap();
        }
        sqlx::query("UPDATE company SET name='شرکت موجود' WHERE id=1").execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO machines(id,name,count,status,notes,sort_order) VALUES('old','لودر',2,'active','',1)").execute(&pool).await.unwrap();
        pool.close().await;
        let pool=open_database(path.clone()).await.unwrap();
        let name:String=sqlx::query_scalar("SELECT name FROM company WHERE id=1").fetch_one(&pool).await.unwrap();
        let machines:i64=sqlx::query_scalar("SELECT COUNT(*) FROM machines").fetch_one(&pool).await.unwrap();
        let customers:i64=sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&pool).await.unwrap();
        assert_eq!(name,"شرکت موجود");assert_eq!(machines,1);assert_eq!(customers,0);
        pool.close().await;std::fs::remove_file(path).unwrap();
    }
}
