mod company;
mod customers;
mod employees;
mod attendance;
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

#[tauri::command]
async fn list_employees(db:State<'_,Database>)->Result<Vec<employees::Employee>,String>{employees::list(&db.0).await}
#[tauri::command]
async fn save_employee(db:State<'_,Database>,id:Option<String>,revision:Option<i64>,input:employees::EmployeeInput)->Result<(),String>{employees::save(&db.0,id,revision,input).await}
#[tauri::command]
async fn delete_employee(db:State<'_,Database>,id:String,revision:i64)->Result<(),String>{employees::delete(&db.0,id,revision).await}

#[tauri::command]
async fn attendance_day(db:State<'_,Database>,work_date:String)->Result<Vec<attendance::DayRow>,String>{attendance::day(&db.0,work_date).await}
#[tauri::command]
async fn save_attendance(db:State<'_,Database>,work_date:String,changes:Vec<attendance::Change>)->Result<(),String>{attendance::save(&db.0,work_date,changes).await}

#[tauri::command]
async fn attendance_month(db:State<'_,Database>,year:i64,month:i64)->Result<attendance::MonthReport,String>{attendance::month(&db.0,year,month).await}
#[tauri::command]
async fn attendance_summary(db:State<'_,Database>,from:String,to:String)->Result<Vec<attendance::SummaryRow>,String>{attendance::summary(&db.0,from,to).await}

#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default().setup(|app|{
        let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;
        let db=tauri::async_runtime::block_on(open_database(dir.join("farday-next.sqlite3")))?;
        app.manage(Database(db));Ok(())
    }).invoke_handler(tauri::generate_handler![company_snapshot,save_company,save_machine,delete_machine,list_customers,save_customer,delete_customer,list_employees,save_employee,delete_employee,attendance_day,save_attendance,attendance_month,attendance_summary])
      .run(tauri::generate_context!()).expect("failed to start preview");
}

#[cfg(test)]
mod migration_tests {
    use super::*;
    use sqlx::migrate::{Migrate,Migrator};
    static MIGRATIONS:Migrator=sqlx::migrate!();
    #[tokio::test]
    async fn upgrading_old_databases_preserves_existing_data() {
        for last in [1,2,3] {
            let path=std::env::temp_dir().join(format!("farday-upgrade-{}.sqlite3",uuid::Uuid::new_v4()));
            let options=SqliteConnectOptions::new().filename(&path).create_if_missing(true);
            let pool=SqlitePoolOptions::new().max_connections(1).connect_with(options).await.unwrap();
            {
                let mut conn=pool.acquire().await.unwrap();
                conn.ensure_migrations_table().await.unwrap();
                for version in 1..=last {conn.apply(MIGRATIONS.iter().find(|m|m.version==version).unwrap()).await.unwrap();}
            }
            sqlx::query("UPDATE company SET name='شرکت موجود' WHERE id=1").execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO machines(id,name,count,status,notes,sort_order) VALUES('old','لودر',2,'active','',1)").execute(&pool).await.unwrap();
            if last>=2 {sqlx::query("INSERT INTO customers(id,code,name,opening_balance_minor) VALUES('old-c','CUS-001','مشتری موجود',12345)").execute(&pool).await.unwrap();}
            if last>=3 {sqlx::query("INSERT INTO employees(id,emp_code,full_name,status) VALUES('old-e','EMP-001','کارمند موجود','active')").execute(&pool).await.unwrap();}
            pool.close().await;
            let pool=open_database(path.clone()).await.unwrap();
            let name:String=sqlx::query_scalar("SELECT name FROM company WHERE id=1").fetch_one(&pool).await.unwrap();
            let machines:i64=sqlx::query_scalar("SELECT COUNT(*) FROM machines").fetch_one(&pool).await.unwrap();
            let customers:i64=sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&pool).await.unwrap();
            let employees:i64=sqlx::query_scalar("SELECT COUNT(*) FROM employees").fetch_one(&pool).await.unwrap();
            let attendance:i64=sqlx::query_scalar("SELECT COUNT(*) FROM attendance").fetch_one(&pool).await.unwrap();
            assert_eq!(name,"شرکت موجود");assert_eq!(machines,1);assert_eq!(customers,if last>=2 {1}else{0});assert_eq!(employees,if last>=3 {1}else{0});assert_eq!(attendance,0);
            if last>=2 {let balance:i64=sqlx::query_scalar("SELECT opening_balance_minor FROM customers WHERE id='old-c'").fetch_one(&pool).await.unwrap();assert_eq!(balance,12345);}
            pool.close().await;std::fs::remove_file(path).unwrap();
        }
    }
}
