//! Conservative restore for the first eleven desktop schemas only.
//! Source rows are copied as values, never executed as SQL. The target stays in a
//! single write transaction, and a verified snapshot is made while writes are locked.
use futures_util::TryStreamExt;
use serde::Serialize;
use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, Row, SqliteConnection, SqlitePool};
use std::path::{Path, PathBuf};
use uuid::Uuid;
use crate::service::create_backup;

const SCHEMA_VERSION: i64 = 11;
const MAX_SCALED: i64 = 1_000_000_000_000;
const MAX_BACKUP_BYTES: u64 = 1024 * 1024 * 1024;
const TABLES: [&str; 4] = ["_sqlx_migrations", "customers", "sales", "receipts"];

#[derive(Serialize)]
pub(crate) struct BackupInfo { schema_version: i64, customers: i64, sales: i64, receipts: i64, employees: i64, expenses: i64, salaries: i64, attendance: i64, cashbox: i64, calendar: String }
#[derive(Serialize)]
pub(crate) struct RestoreResult { safety_backup: String, customers: i64, sales: i64, receipts: i64, employees: i64, expenses: i64, salaries: i64, attendance: i64, cashbox: i64, calendar: String }

fn error<E: std::fmt::Display>(err: E) -> String {
    eprintln!("Restore error: {err}");
    "بررسی یا بازگردانی پشتیبان ناموفق بود.".into()
}

async fn open_source(path: &Path) -> Result<SqlitePool, String> {
    if !path.is_absolute() || path.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()).as_deref() != Some("sqlite3") {
        return Err("یک فایل پشتیبان با پسوند sqlite3 انتخاب کنید.".into());
    }
    let metadata = std::fs::metadata(path).map_err(|_| "فایل پشتیبان خوانده نشد.")?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_BACKUP_BYTES {
        return Err("فایل پشتیبان معتبر نیست یا بیش از یک گیگابایت است.".into());
    }
    let opts = SqliteConnectOptions::new().filename(path).read_only(true).foreign_keys(true);
    SqlitePoolOptions::new().max_connections(1).connect_with(opts).await.map_err(error)
}

async fn live_path(db: &SqlitePool) -> Result<PathBuf, String> {
    let rows = sqlx::query("PRAGMA database_list").fetch_all(db).await.map_err(error)?;
    let row = rows.iter().find(|r| r.try_get::<String, _>("name").ok().as_deref() == Some("main"))
        .ok_or("مسیر دیتابیس فعلی یافت نشد.")?;
    let filename: String = row.try_get("file").map_err(error)?;
    if filename.is_empty() { return Err("دیتابیس فعلی فایل محلی نیست.".into()); }
    Ok(PathBuf::from(filename))
}

async fn validate(source: &mut SqliteConnection, target: &mut SqliteConnection) -> Result<BackupInfo, String> {
    // The destination must be the exact migration set handled by this code.
    let target_migrations = sqlx::query("SELECT version, checksum, success FROM _sqlx_migrations ORDER BY version")
        .fetch_all(&mut *target).await.map_err(error)?;
    if target_migrations.len() != SCHEMA_VERSION as usize {
        return Err("این نسخه از ساختار دیتابیس برای بازیابی پشتیبانی نمی‌شود.".into());
    }
    let supplied = sqlx::query("SELECT version, checksum, success FROM _sqlx_migrations ORDER BY version")
        .fetch_all(&mut *source).await.map_err(error)?;
    if supplied.is_empty() || supplied.len() > SCHEMA_VERSION as usize {
        return Err("نسخهٔ فایل پشتیبان با این برنامه سازگار نیست.".into());
    }
    for (i, target_migration) in target_migrations.iter().enumerate() {
        if target_migration.try_get::<i64, _>("version").map_err(error)? != i as i64 + 1
            || !target_migration.try_get::<bool, _>("success").map_err(error)? {
            return Err("نسخهٔ دیتابیس فعلی برای بازیابی پشتیبانی نمی‌شود.".into());
        }
        if let Some(source_migration) = supplied.get(i) {
            if source_migration.try_get::<i64, _>("version").map_err(error)? != i as i64 + 1
                || !source_migration.try_get::<bool, _>("success").map_err(error)?
                || source_migration.try_get::<Vec<u8>, _>("checksum").map_err(error)? != target_migration.try_get::<Vec<u8>, _>("checksum").map_err(error)? {
                return Err("نسخهٔ فایل پشتیبان با این برنامه سازگار نیست.".into());
            }
        }
    }
    for table in TABLES.iter().copied().chain(if supplied.len() >= 2 { Some("employees") } else { None }).chain(if supplied.len() >= 3 { Some("expenses") } else { None }).chain(if supplied.len() >= 4 { Some("salaries") } else { None }).chain(if supplied.len() >= 5 { Some("attendance") } else { None }).chain(if supplied.len() >= 6 { Some("sale_details") } else { None }).chain(if supplied.len() >= 6 { Some("receipt_details") } else { None }).chain(if supplied.len() >= 7 { Some("sale_numbers") } else { None }).chain(if supplied.len() >= 7 { Some("receipt_numbers") } else { None }).chain(if supplied.len() >= 8 { Some("cashbox_entries") } else { None }).chain(if supplied.len() >= 9 { Some("app_preferences") } else { None }).chain(if supplied.len() >= 10 { Some("audit_events") } else { None }).chain(if supplied.len() >= 11 { Some("local_users") } else { None }) {
        let schema = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?";
        let expected: Option<String> = sqlx::query_scalar(schema).bind(table).fetch_optional(&mut *target).await.map_err(error)?;
        let actual: Option<String> = sqlx::query_scalar(schema).bind(table).fetch_optional(&mut *source).await.map_err(error)?;
        if expected.is_none() || expected != actual {
            return Err("ساختار فایل پشتیبان با این نسخه سازگار نیست.".into());
        }
    }
    // An older backup must not contain later tables that would be silently ignored.
    for (version, table) in [(2, "employees"), (3, "expenses"), (4, "salaries"), (5, "attendance"), (6, "sale_details"), (6, "receipt_details"), (7, "sale_numbers"), (7, "receipt_numbers"), (8, "cashbox_entries"), (9, "app_preferences"), (10, "audit_events"), (11, "local_users")] {
        if supplied.len() < version {
            let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?").bind(table).fetch_one(&mut *source).await.map_err(error)?;
            if exists != 0 { return Err("نسخه و ساختار فایل پشتیبان هماهنگ نیست.".into()); }
        }
    }
    let checks: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&mut *source).await.map_err(error)?;
    if checks.len() != 1 || checks[0] != "ok" || !sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut *source).await.map_err(error)?.is_empty() {
        return Err("فایل پشتیبان خراب است یا ارتباطات معتبر ندارد.".into());
    }
    if supplied.len() >= 7 {
        for table in ["sale_numbers", "receipt_numbers"] {
            let rows=sqlx::query("SELECT seq,typeof(seq) AS seq_type FROM sqlite_sequence WHERE name=?").bind(table).fetch_all(&mut *source).await.map_err(error)?;
            if rows.len()>1 { return Err("شمارندهٔ شمارهٔ سند در پشتیبان معتبر نیست.".into()); }
            let max_number:i64=sqlx::query_scalar(&format!("SELECT COALESCE(MAX(number),0) FROM {table}")).fetch_one(&mut *source).await.map_err(error)?;
            if let Some(row)=rows.first() {
                let kind:String=row.try_get("seq_type").map_err(error)?;
                let seq:i64=row.try_get("seq").map_err(error)?;
                if kind!="integer" || !(0..=9_000_000_000_000_000).contains(&seq) || seq<max_number { return Err("شمارندهٔ شمارهٔ سند در پشتیبان معتبر نیست.".into()); }
            } else if max_number != 0 { return Err("شمارندهٔ شمارهٔ سند در پشتیبان معتبر نیست.".into()); }
        }
    }
    let customers: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&mut *source).await.map_err(error)?;
    let sales: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sales").fetch_one(&mut *source).await.map_err(error)?;
    let receipts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM receipts").fetch_one(&mut *source).await.map_err(error)?;
    let employees = if supplied.len() >= 2 { sqlx::query_scalar("SELECT COUNT(*) FROM employees").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let expenses = if supplied.len() >= 3 { sqlx::query_scalar("SELECT COUNT(*) FROM expenses").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let salaries = if supplied.len() >= 4 { sqlx::query_scalar("SELECT COUNT(*) FROM salaries").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let attendance = if supplied.len() >= 5 { sqlx::query_scalar("SELECT COUNT(*) FROM attendance").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let cashbox = if supplied.len() >= 8 { sqlx::query_scalar("SELECT COUNT(*) FROM cashbox_entries").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let calendar = if supplied.len() >= 9 {
        let rows=sqlx::query("SELECT id,calendar FROM app_preferences").fetch_all(&mut *source).await.map_err(error)?;
        if rows.len()!=1 || rows[0].try_get::<i64,_>("id").map_err(error)? != 1 { return Err("تنظیم تقویم در پشتیبان معتبر نیست.".into()); }
        let value:String=rows[0].try_get("calendar").map_err(error)?;
        if !matches!(value.as_str(),"shamsi"|"miladi") {return Err("تنظیم تقویم در پشتیبان معتبر نیست.".into());} value
    } else { "shamsi".to_string() };
    Ok(BackupInfo { schema_version: supplied.len() as i64, customers, sales, receipts, employees, expenses, salaries, attendance, cashbox, calendar })
}

pub(crate) async fn inspect(db: &SqlitePool, path: PathBuf) -> Result<BackupInfo, String> {
    let live = live_path(db).await?;
    if std::fs::canonicalize(&path).map_err(error)? == std::fs::canonicalize(live).map_err(error)? {
        return Err("دیتابیس فعال را نمی‌توان به عنوان فایل پشتیبان انتخاب کرد.".into());
    }
    let source = open_source(&path).await?;
    let mut read = source.begin().await.map_err(error)?;
    let mut target = db.begin().await.map_err(error)?;
    let info = validate(&mut read, &mut target).await?;
    target.commit().await.map_err(error)?;
    read.commit().await.map_err(error)?;
    source.close().await;
    Ok(info)
}

pub(crate) async fn restore(db: &SqlitePool, path: PathBuf, safety_dir: PathBuf) -> Result<RestoreResult, String> {
    let live = live_path(db).await?;
    if std::fs::canonicalize(&path).map_err(error)? == std::fs::canonicalize(&live).map_err(error)? {
        return Err("دیتابیس فعال را نمی‌توان بازگردانی کرد.".into());
    }
    let source = open_source(&path).await?;
    let mut read = source.begin().await.map_err(error)?;
    // Acquiring a RESERVED lock blocks other SQLite writers until the operation
    // commits/rolls back. A separate read-only connection can still export it.
    let mut write = db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let info = validate(&mut read, &mut write).await?;
    std::fs::create_dir_all(&safety_dir).map_err(error)?;
    let safety_path = safety_dir.join(format!("before-restore-{}.sqlite3", Uuid::new_v4()));
    let live_read = SqlitePoolOptions::new().max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(&live).read_only(true).foreign_keys(true)).await.map_err(error)?;
    let backup_result = create_backup(&live_read, safety_path.clone()).await;
    live_read.close().await;
    backup_result.map_err(|_| "نسخهٔ ایمنی ساخته نشد؛ بازگردانی انجام نشد.".to_string())?;

    let copy = async {
        let changed=sqlx::query("UPDATE app_preferences SET calendar=? WHERE id=1").bind(&info.calendar).execute(&mut *write).await.map_err(error)?.rows_affected();
        if changed!=1 {return Err("تنظیم تقویم فعلی معتبر نیست؛ بازگردانی انجام نشد.".into());}
        for sql in ["DELETE FROM cashbox_entries", "DELETE FROM sale_numbers", "DELETE FROM receipt_numbers", "DELETE FROM sale_details", "DELETE FROM receipt_details", "DELETE FROM attendance", "DELETE FROM salaries", "DELETE FROM receipts", "DELETE FROM sales", "DELETE FROM customers", "DELETE FROM employees", "DELETE FROM expenses"] {
            sqlx::query(sql).execute(&mut *write).await.map_err(error)?;
        }
        let mut rows = sqlx::query("SELECT id,code,name,phone,opening_cents,created_at FROM customers ORDER BY id").fetch(&mut *read);
        while let Some(r) = rows.try_next().await.map_err(error)? {
            let code: String = r.try_get(1).map_err(error)?;
            let name: String = r.try_get(2).map_err(error)?;
            let phone: String = r.try_get(3).map_err(error)?;
            let opening: i64 = r.try_get(4).map_err(error)?;
            if code.trim().is_empty() || code.len() > 80 || name.trim().is_empty() || name.len() > 320 || phone.len() > 120 || !(0..=MAX_SCALED).contains(&opening) {
                return Err("معلومات مشتری در فایل پشتیبان معتبر نیست.".into());
            }
            sqlx::query("INSERT INTO customers(id,code,name,phone,opening_cents,created_at) VALUES(?,?,?,?,?,?)")
                .bind(r.try_get::<String,_>(0).map_err(error)?).bind(r.try_get::<String,_>(1).map_err(error)?)
                .bind(r.try_get::<String,_>(2).map_err(error)?).bind(r.try_get::<String,_>(3).map_err(error)?)
                .bind(r.try_get::<i64,_>(4).map_err(error)?).bind(r.try_get::<String,_>(5).map_err(error)?)
                .execute(&mut *write).await.map_err(error)?;
        }
        drop(rows);
        let mut rows = sqlx::query("SELECT id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type,created_at FROM sales ORDER BY id").fetch(&mut *read);
        while let Some(r) = rows.try_next().await.map_err(error)? {
            let date: String = r.try_get(2).map_err(error)?;
            let material: String = r.try_get(3).map_err(error)?;
            let volume: i64 = r.try_get(4).map_err(error)?;
            let price: i64 = r.try_get(5).map_err(error)?;
            let freight: i64 = r.try_get(6).map_err(error)?;
            let total: i64 = r.try_get(7).map_err(error)?;
            if crate::service::valid_date(&date).is_err() || material.trim().is_empty() || material.len() > 200
                || !(1..=MAX_SCALED).contains(&volume) || !(0..=MAX_SCALED).contains(&price)
                || !(0..=MAX_SCALED).contains(&freight) || !(0..=MAX_SCALED).contains(&total) {
                return Err("تاریخ یا مبلغ فروش در فایل پشتیبان معتبر نیست.".into());
            }
            let expected = (volume as i128 * (price as i128 + freight as i128) + 500) / 1000;
            if expected != total as i128 {
                return Err("محاسبهٔ فروش در فایل پشتیبان معتبر نیست.".into());
            }
            sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
                .bind(r.try_get::<String,_>(0).map_err(error)?).bind(r.try_get::<String,_>(1).map_err(error)?)
                .bind(r.try_get::<String,_>(2).map_err(error)?).bind(r.try_get::<String,_>(3).map_err(error)?)
                .bind(r.try_get::<i64,_>(4).map_err(error)?).bind(r.try_get::<i64,_>(5).map_err(error)?)
                .bind(r.try_get::<i64,_>(6).map_err(error)?).bind(r.try_get::<i64,_>(7).map_err(error)?)
                .bind(r.try_get::<String,_>(8).map_err(error)?).bind(r.try_get::<String,_>(9).map_err(error)?)
                .execute(&mut *write).await.map_err(error)?;
        }
        drop(rows);
        let mut rows = sqlx::query("SELECT id,customer_id,receipt_date,amount_cents,source,created_at FROM receipts ORDER BY id").fetch(&mut *read);
        while let Some(r) = rows.try_next().await.map_err(error)? {
            let date: String = r.try_get(2).map_err(error)?;
            let amount: i64 = r.try_get(3).map_err(error)?;
            if crate::service::valid_date(&date).is_err() || !(1..=MAX_SCALED).contains(&amount) {
                return Err("تاریخ یا مبلغ رسید در فایل پشتیبان معتبر نیست.".into());
            }
            sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source,created_at) VALUES(?,?,?,?,?,?)")
                .bind(r.try_get::<String,_>(0).map_err(error)?).bind(r.try_get::<String,_>(1).map_err(error)?)
                .bind(r.try_get::<String,_>(2).map_err(error)?).bind(r.try_get::<i64,_>(3).map_err(error)?)
                .bind(r.try_get::<String,_>(4).map_err(error)?).bind(r.try_get::<String,_>(5).map_err(error)?)
                .execute(&mut *write).await.map_err(error)?;
        }
        drop(rows);
        if info.schema_version >= 8 {
            let mut rows=sqlx::query("SELECT id,entry_date,direction,description,amount_afn_cents,amount_usd_cents,created_at FROM cashbox_entries ORDER BY id").fetch(&mut *read);
            while let Some(r)=rows.try_next().await.map_err(error)? {
                let date:String=r.try_get(1).map_err(error)?; let direction:String=r.try_get(2).map_err(error)?; let description:String=r.try_get(3).map_err(error)?;
                let afn:i64=r.try_get(4).map_err(error)?; let usd:i64=r.try_get(5).map_err(error)?;
                if crate::service::valid_date(&date).is_err() || !matches!(direction.as_str(),"in"|"out") || description.trim().is_empty() || description.len()>1000 || !(0..=MAX_SCALED).contains(&afn) || !(0..=MAX_SCALED).contains(&usd) || (afn==0 && usd==0) {return Err("رکورد دخل در پشتیبان معتبر نیست.".into());}
                sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents,amount_usd_cents,created_at) VALUES(?,?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(date).bind(direction).bind(description).bind(afn).bind(usd).bind(r.try_get::<String,_>(6).map_err(error)?).execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        if info.schema_version >= 7 {
            // Preserve existing IDs and both sequence high-water marks, including deleted numbers.
            for (table,column) in [("sale_numbers","sale_id"),("receipt_numbers","receipt_id")] {
                let seq:Option<i64>=sqlx::query_scalar("SELECT seq FROM sqlite_sequence WHERE name=?").bind(table).fetch_optional(&mut *read).await.map_err(error)?;
                if seq.is_some_and(|n| !(0..=9_000_000_000_000_000).contains(&n)) {return Err("شمارندهٔ شمارهٔ سند در پشتیبان معتبر نیست.".into());}
                let select=format!("SELECT number,{column} FROM {table} ORDER BY number");
                let insert=format!("INSERT INTO {table}(number,{column}) VALUES(?,?)");
                let mut rows=sqlx::query(&select).fetch(&mut *read);
                while let Some(r)=rows.try_next().await.map_err(error)? {
                    let number:i64=r.try_get(0).map_err(error)?; let id:String=r.try_get(1).map_err(error)?;
                    if !(1..=9_000_000_000_000_000).contains(&number) {return Err("شمارهٔ سند در پشتیبان معتبر نیست.".into());}
                    sqlx::query(&insert).bind(number).bind(id).execute(&mut *write).await.map_err(error)?;
                }
                drop(rows);
                if let Some(seq)=seq {
                    sqlx::query("INSERT INTO sqlite_sequence(name,seq) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name=?)").bind(table).bind(seq).bind(table).execute(&mut *write).await.map_err(error)?;
                    sqlx::query("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?").bind(seq).bind(table).execute(&mut *write).await.map_err(error)?;
                }
            }
        }
        // Older backups had no local numbers; number missing rows without resetting counters.
        sqlx::query("INSERT INTO sale_numbers(sale_id) SELECT s.id FROM sales s LEFT JOIN sale_numbers n ON n.sale_id=s.id WHERE n.sale_id IS NULL ORDER BY s.created_at,s.id").execute(&mut *write).await.map_err(error)?;
        sqlx::query("INSERT INTO receipt_numbers(receipt_id) SELECT r.id FROM receipts r LEFT JOIN receipt_numbers n ON n.receipt_id=r.id WHERE n.receipt_id IS NULL ORDER BY r.created_at,r.id").execute(&mut *write).await.map_err(error)?;
        if info.schema_version >= 6 {
            let mut rows=sqlx::query("SELECT sale_id,bill_no,driver_name,vehicle_plate,destination,notes FROM sale_details ORDER BY sale_id").fetch(&mut *read);
            while let Some(r)=rows.try_next().await.map_err(error)? {
                let bill:String=r.try_get(1).map_err(error)?; let driver:String=r.try_get(2).map_err(error)?; let plate:String=r.try_get(3).map_err(error)?;
                let destination:String=r.try_get(4).map_err(error)?; let notes:String=r.try_get(5).map_err(error)?;
                if bill.len()>160 || driver.len()>320 || plate.len()>160 || destination.len()>320 || notes.len()>4000 { return Err("جزئیات فروش در فایل پشتیبان معتبر نیست.".into()); }
                sqlx::query("INSERT INTO sale_details(sale_id,bill_no,driver_name,vehicle_plate,destination,notes) VALUES(?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(bill).bind(driver).bind(plate).bind(destination).bind(notes).execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
            let mut rows=sqlx::query("SELECT receipt_id,related_bill_no,received_by,notes FROM receipt_details ORDER BY receipt_id").fetch(&mut *read);
            while let Some(r)=rows.try_next().await.map_err(error)? {
                let bill:String=r.try_get(1).map_err(error)?; let received:String=r.try_get(2).map_err(error)?; let notes:String=r.try_get(3).map_err(error)?;
                if bill.len()>160 || received.len()>320 || notes.len()>4000 { return Err("جزئیات رسید در فایل پشتیبان معتبر نیست.".into()); }
                sqlx::query("INSERT INTO receipt_details(receipt_id,related_bill_no,received_by,notes) VALUES(?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(bill).bind(received).bind(notes).execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        if info.schema_version >= 2 {
            let mut rows = sqlx::query("SELECT id,code,name,father_name,job_title,hire_date,base_salary_cents,phone,status,created_at,updated_at FROM employees ORDER BY id").fetch(&mut *read);
            while let Some(r) = rows.try_next().await.map_err(error)? {
                let code: String = r.try_get(1).map_err(error)?;
                let name: String = r.try_get(2).map_err(error)?;
                let father: String = r.try_get(3).map_err(error)?;
                let title: String = r.try_get(4).map_err(error)?;
                let hire: Option<String> = r.try_get(5).map_err(error)?;
                let salary: i64 = r.try_get(6).map_err(error)?;
                let phone: String = r.try_get(7).map_err(error)?;
                let status: String = r.try_get(8).map_err(error)?;
                if code.trim().is_empty() || code.len() > 80 || name.trim().is_empty() || name.len() > 320 || father.len() > 320 || title.len() > 240 || phone.len() > 120
                    || !(0..=MAX_SCALED).contains(&salary) || !matches!(status.as_str(), "active" | "inactive")
                    || hire.as_ref().is_some_and(|date| crate::service::valid_date(date).is_err()) {
                    return Err("معلومات کارمند در فایل پشتیبان معتبر نیست.".into());
                }
                sqlx::query("INSERT INTO employees(id,code,name,father_name,job_title,hire_date,base_salary_cents,phone,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(code).bind(name).bind(father).bind(title).bind(hire).bind(salary).bind(phone).bind(status)
                    .bind(r.try_get::<String,_>(9).map_err(error)?).bind(r.try_get::<String,_>(10).map_err(error)?)
                    .execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        if info.schema_version >= 3 {
            let mut rows = sqlx::query("SELECT id,expense_date,description,expense_type,purchase_bill_no,shop_name,amount_afn_cents,amount_usd_cents,payer,payment_method,notes,created_at,updated_at FROM expenses ORDER BY id").fetch(&mut *read);
            while let Some(r) = rows.try_next().await.map_err(error)? {
                let date: String = r.try_get(1).map_err(error)?;
                let description: String = r.try_get(2).map_err(error)?;
                let category: String = r.try_get(3).map_err(error)?;
                let bill: String = r.try_get(4).map_err(error)?;
                let shop: String = r.try_get(5).map_err(error)?;
                let afn: i64 = r.try_get(6).map_err(error)?;
                let usd: i64 = r.try_get(7).map_err(error)?;
                let payer: String = r.try_get(8).map_err(error)?;
                let method: String = r.try_get(9).map_err(error)?;
                let notes: String = r.try_get(10).map_err(error)?;
                if crate::service::valid_date(&date).is_err() || description.trim().is_empty() || description.len() > 1000
                    || category.len() > 320 || bill.len() > 320 || shop.len() > 320 || payer.len() > 320 || notes.len() > 4000
                    || !(0..=MAX_SCALED).contains(&afn) || !(0..=MAX_SCALED).contains(&usd) || (afn == 0 && usd == 0)
                    || !matches!(method.as_str(), "cash" | "credit") {
                    return Err("معلومات مصرف در فایل پشتیبان معتبر نیست.".into());
                }
                sqlx::query("INSERT INTO expenses(id,expense_date,description,expense_type,purchase_bill_no,shop_name,amount_afn_cents,amount_usd_cents,payer,payment_method,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(date).bind(description).bind(category).bind(bill).bind(shop).bind(afn).bind(usd).bind(payer).bind(method).bind(notes)
                    .bind(r.try_get::<String,_>(11).map_err(error)?).bind(r.try_get::<String,_>(12).map_err(error)?)
                    .execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        if info.schema_version >= 4 {
            let mut rows = sqlx::query("SELECT id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payer,payment_type,notes,created_at,updated_at FROM salaries ORDER BY id").fetch(&mut *read);
            while let Some(r) = rows.try_next().await.map_err(error)? {
                let calendar: String = r.try_get(2).map_err(error)?;
                let year: i64 = r.try_get(3).map_err(error)?; let month: i64 = r.try_get(4).map_err(error)?;
                let date: String = r.try_get(5).map_err(error)?;
                let base: i64 = r.try_get(6).map_err(error)?; let bonus: i64 = r.try_get(7).map_err(error)?;
                let fine: i64 = r.try_get(8).map_err(error)?; let overtime: i64 = r.try_get(9).map_err(error)?;
                let total: i64 = r.try_get(10).map_err(error)?; let payer: String = r.try_get(11).map_err(error)?;
                let method: String = r.try_get(12).map_err(error)?; let notes: String = r.try_get(13).map_err(error)?;
                if !crate::salaries::valid_period(&calendar, year, month) || crate::service::valid_date(&date).is_err()
                    || [base, bonus, fine, overtime].iter().any(|amount| !(0..=MAX_SCALED).contains(amount))
                    || total != base + bonus + overtime - fine || payer.len() > 320 || notes.len() > 4000
                    || !matches!(method.as_str(), "cash" | "transfer") {
                    return Err("معلومات معاش در فایل پشتیبان معتبر نیست.".into());
                }
                sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payer,payment_type,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(r.try_get::<String,_>(1).map_err(error)?).bind(calendar).bind(year).bind(month).bind(date)
                    .bind(base).bind(bonus).bind(fine).bind(overtime).bind(total).bind(payer).bind(method).bind(notes)
                    .bind(r.try_get::<String,_>(14).map_err(error)?).bind(r.try_get::<String,_>(15).map_err(error)?)
                    .execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        if info.schema_version >= 5 {
            let mut rows=sqlx::query("SELECT id,employee_id,work_date,status,check_in,check_out,overtime_hundredths,notes,created_at,updated_at FROM attendance ORDER BY id").fetch(&mut *read);
            while let Some(r)=rows.try_next().await.map_err(error)? {
                let date:String=r.try_get(2).map_err(error)?; let status:String=r.try_get(3).map_err(error)?;
                let check_in:Option<String>=r.try_get(4).map_err(error)?; let check_out:Option<String>=r.try_get(5).map_err(error)?;
                let overtime:i64=r.try_get(6).map_err(error)?; let notes:String=r.try_get(7).map_err(error)?;
                if crate::service::valid_date(&date).is_err() || !crate::attendance::valid_status(&status)
                    || crate::attendance::parse_time(check_in.as_deref()) != Ok(check_in.clone())
                    || crate::attendance::parse_time(check_out.as_deref()) != Ok(check_out.clone())
                    || !(0..=99999).contains(&overtime) || notes.len()>1020 {
                    return Err("معلومات حضور و غیاب در فایل پشتیبان معتبر نیست.".into());
                }
                sqlx::query("INSERT INTO attendance(id,employee_id,work_date,status,check_in,check_out,overtime_hundredths,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
                    .bind(r.try_get::<String,_>(0).map_err(error)?).bind(r.try_get::<String,_>(1).map_err(error)?).bind(date).bind(status).bind(check_in).bind(check_out).bind(overtime).bind(notes)
                    .bind(r.try_get::<String,_>(8).map_err(error)?).bind(r.try_get::<String,_>(9).map_err(error)?).execute(&mut *write).await.map_err(error)?;
            }
            drop(rows);
        }
        // Keep this device's journal, never import the source's potentially unrelated history.
        // The marker and all trigger-generated changes roll back with the restore on failure.
        sqlx::query("INSERT INTO audit_events(entity,entity_id,operation,after_json) VALUES('backup','local','restore',json_object('source_schema_version',?))")
            .bind(info.schema_version).execute(&mut *write).await.map_err(error)?;
        if !sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut *write).await.map_err(error)?.is_empty() {
            return Err("ارتباطات اطلاعات بازگردانی‌شده معتبر نیست.".to_string());
        }
        Ok::<(), String>(())
    }.await;
    if let Err(err) = copy {
        write.rollback().await.map_err(error)?;
        return Err(format!("{err} نسخهٔ ایمنی: {}", safety_path.display()));
    }
    if let Err(err) = read.commit().await {
        write.rollback().await.map_err(error)?;
        return Err(format!("{} نسخهٔ ایمنی: {}", error(err), safety_path.display()));
    }
    source.close().await;
    write.commit().await.map_err(|err| format!("{} نسخهٔ ایمنی: {}", error(err), safety_path.display()))?;
    Ok(RestoreResult { safety_backup: safety_path.to_string_lossy().into_owned(), customers: info.customers, sales: info.sales, receipts: info.receipts, employees: info.employees, expenses: info.expenses, salaries: info.salaries, attendance: info.attendance, cashbox: info.cashbox, calendar: info.calendar })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::open_database;

    // Tests create old-version fixtures from a newer database; drop journal triggers first.
    async fn remove_users(db:&SqlitePool) { sqlx::query("DROP TABLE local_users").execute(db).await.unwrap(); }
    async fn remove_audit(db:&SqlitePool) {
        remove_users(db).await;
        let triggers:Vec<String>=sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'audit_%'").fetch_all(db).await.unwrap();
        for name in triggers { sqlx::query(&format!("DROP TRIGGER \"{}\"",name.replace('\"',"\"\""))).execute(db).await.unwrap(); }
        sqlx::query("DROP TABLE audit_events").execute(db).await.unwrap();
    }

    #[tokio::test]
    async fn restores_transactionally_and_keeps_a_safety_copy() {
        let base = std::env::temp_dir().join(format!("farday-restore-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live_path = base.join("live.sqlite3");
        let saved = base.join("backup.sqlite3");
        let live = open_database(live_path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name,opening_cents) VALUES ('c1','C1','اول',10000)").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES ('s1','c1','2026-01-01','ریگ',1000,20000,0,20000,'credit')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES ('r1','c1','2026-01-02',5000,'deposit')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sale_details(sale_id,bill_no,driver_name) VALUES('s1','BL-1','راننده')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO receipt_details(receipt_id,received_by) VALUES('r1','دریافت کننده')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name,base_salary_cents) VALUES ('e1','E1','کارمند',120000)").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES ('x1','2026-01-01','تیل',100,200,'cash')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES ('p1','e1','shamsi',1404,1,'2026-01-01',100,10,5,0,105,'cash')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO attendance(id,employee_id,work_date,status,check_in,overtime_hundredths) VALUES('a1','e1','2026-01-01','present','08:00',125)").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents) VALUES('m','2026-01-01','in','نقد',750)").execute(&live).await.unwrap();
        sqlx::query("UPDATE app_preferences SET calendar='miladi'").execute(&live).await.unwrap();
        create_backup(&live, saved.clone()).await.unwrap();
        sqlx::query("UPDATE app_preferences SET calendar='shamsi'").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM cashbox_entries").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM attendance").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM salaries").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM expenses").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM employees").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('c2','C2','دوم')").execute(&live).await.unwrap();
        let preview = inspect(&live, saved.clone()).await.unwrap();
        assert_eq!((preview.customers, preview.sales, preview.receipts, preview.employees, preview.expenses, preview.salaries, preview.attendance, preview.schema_version), (1, 1, 1, 1, 1, 1, 1, 11));
        assert_eq!(preview.calendar,"miladi");
        let before_audit:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap();
        let result = restore(&live, saved.clone(), base.join("safety")).await.unwrap();
        assert!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap()>before_audit);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events WHERE operation='restore'").fetch_one(&live).await.unwrap(),1);
        assert_eq!(result.calendar,"miladi");
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT calendar FROM app_preferences").fetch_one(&live).await.unwrap(),"miladi");
        assert_eq!((result.customers, result.sales, result.receipts, result.employees, result.expenses, result.salaries, result.attendance), (1, 1, 1, 1, 1, 1, 1));
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&live).await.unwrap(), 1);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT amount_usd_cents FROM expenses").fetch_one(&live).await.unwrap(), 200);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT total_cents FROM salaries").fetch_one(&live).await.unwrap(), 105);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT overtime_hundredths FROM attendance").fetch_one(&live).await.unwrap(), 125);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT amount_afn_cents FROM cashbox_entries").fetch_one(&live).await.unwrap(),750);
        assert_eq!(sqlx::query_scalar::<_, String>("SELECT bill_no FROM sale_details").fetch_one(&live).await.unwrap(), "BL-1");
        assert_eq!(sqlx::query_scalar::<_, String>("SELECT received_by FROM receipt_details").fetch_one(&live).await.unwrap(), "دریافت کننده");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&live).await.unwrap();
        assert_eq!(count, 1);
        let safety = open_source(Path::new(&result.safety_backup)).await.unwrap();
        let old_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&safety).await.unwrap();
        assert_eq!(old_count, 2);
        safety.close().await;
        assert!(restore(&live, live_path, base.join("safety")).await.is_err());
        live.close().await;
        std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn refuses_incompatible_and_corrupt_files_without_touching_live_data() {
        let base = std::env::temp_dir().join(format!("farday-invalid-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('x','X','حفظ شود')").execute(&live).await.unwrap();
        let invalid = base.join("invalid.sqlite3");
        std::fs::write(&invalid, b"not a database").unwrap();
        assert!(restore(&live, invalid, base.join("safety")).await.is_err());
        let incompatible = base.join("incompatible.sqlite3");
        create_backup(&live, incompatible.clone()).await.unwrap();
        let other = SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&incompatible).foreign_keys(true)).await.unwrap();
        sqlx::query("ALTER TABLE customers ADD COLUMN unsupported TEXT").execute(&other).await.unwrap();
        other.close().await;
        assert!(restore(&live, incompatible, base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM customers").fetch_one(&live).await.unwrap(), 1);
        live.close().await;
        std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn failure_during_copy_rolls_back_and_retains_safety_backup() {
        let base = std::env::temp_dir().join(format!("farday-rollback-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('old','OLD','پشتیبان')").execute(&live).await.unwrap();
        let saved = base.join("backup.sqlite3");
        create_backup(&live, saved.clone()).await.unwrap();
        sqlx::query("UPDATE app_preferences SET calendar='miladi'").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM customers").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('new','NEW','فعلی')").execute(&live).await.unwrap();
        sqlx::query("CREATE TRIGGER reject_old BEFORE INSERT ON customers WHEN NEW.id='old' BEGIN SELECT RAISE(ABORT,'forced test error'); END").execute(&live).await.unwrap();
        let result = restore(&live, saved, base.join("safety")).await;
        assert!(result.is_err());
        let id: String = sqlx::query_scalar("SELECT id FROM customers").fetch_one(&live).await.unwrap();
        assert_eq!(id, "new");
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT calendar FROM app_preferences").fetch_one(&live).await.unwrap(),"miladi");
        assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(), 1);
        live.close().await;
        std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn rejects_tampered_financial_total_and_keeps_current_data() {
        let base = std::env::temp_dir().join(format!("farday-tampered-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('c','C','مشتری')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES ('s','c','2026-01-01','ریگ',1000,20000,0,20000,'credit')").execute(&live).await.unwrap();
        let path = base.join("tampered.sqlite3");
        create_backup(&live, path.clone()).await.unwrap();
        let other = SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&path)).await.unwrap();
        sqlx::query("UPDATE sales SET total_cents=1").execute(&other).await.unwrap();
        other.close().await;
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('new','NEW','فعلی')").execute(&live).await.unwrap();
        assert!(restore(&live, path, base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM customers").fetch_one(&live).await.unwrap(), 2);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT total_cents FROM sales WHERE id='s'").fetch_one(&live).await.unwrap(), 20000);
        assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(), 1);
        live.close().await;
        std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn restores_v1_backups_and_clears_employees_with_safety_copy() {
        let base = std::env::temp_dir().join(format!("farday-v1-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        let saved = base.join("v1.sqlite3");
        create_backup(&live, saved.clone()).await.unwrap();
        let source = SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved).foreign_keys(true)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_details").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE attendance").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE salaries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE expenses").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE employees").execute(&source).await.unwrap();
        sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=2").execute(&source).await.unwrap();
        source.close().await;
        sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&live).await.unwrap();
        let preview = inspect(&live, saved.clone()).await.unwrap();
        assert_eq!((preview.schema_version, preview.employees), (1, 0));
        let result = restore(&live, saved, base.join("safety")).await.unwrap();
        assert_eq!(result.employees, 0);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&live).await.unwrap(), 0);
        let safety = open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&safety).await.unwrap(), 1);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn restores_v2_and_clears_expenses_with_safety_copy() {
        let base = std::env::temp_dir().join(format!("farday-v2-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&live).await.unwrap();
        let saved = base.join("v2.sqlite3"); create_backup(&live, saved.clone()).await.unwrap();
        let source = SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved).foreign_keys(true)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_details").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE attendance").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE salaries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE expenses").execute(&source).await.unwrap();
        sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=3").execute(&source).await.unwrap();
        source.close().await;
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,payment_method) VALUES ('x','2026-01-01','تیل',100,'cash')").execute(&live).await.unwrap();
        let info = inspect(&live, saved.clone()).await.unwrap();
        assert_eq!((info.schema_version, info.employees, info.expenses), (2, 1, 0));
        let result = restore(&live, saved, base.join("safety")).await.unwrap();
        assert_eq!(result.expenses, 0);
        let safety = open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM expenses").fetch_one(&safety).await.unwrap(), 1);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn invalid_expense_rolls_back_and_preserves_safety_backup() {
        let base = std::env::temp_dir().join(format!("farday-invalid-expense-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_usd_cents,payment_method) VALUES ('x','2026-01-01','مصرف',100,'cash')").execute(&live).await.unwrap();
        let saved = base.join("backup.sqlite3"); create_backup(&live, saved.clone()).await.unwrap();
        let source = SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        sqlx::query("UPDATE expenses SET expense_date='2025-02-29'").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE expenses SET description='فعلی' WHERE id='x'").execute(&live).await.unwrap();
        let count_before:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap();
        assert!(restore(&live, saved, base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap(),count_before);
        let description: String = sqlx::query_scalar("SELECT description FROM expenses WHERE id='x'").fetch_one(&live).await.unwrap();
        assert_eq!(description, "فعلی"); assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(), 1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn restore_v9_preserves_local_journal_and_records_restore() {
        let base=std::env::temp_dir().join(format!("restore-audit-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','نسخهٔ قبلی')").execute(&live).await.unwrap();
        let old=base.join("v9.sqlite3"); create_backup(&live,old.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&old)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=10").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE customers SET name='وضعیت فعلی' WHERE id='c'").execute(&live).await.unwrap();
        let before:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap();
        assert_eq!(inspect(&live,old.clone()).await.unwrap().schema_version,9);
        restore(&live,old,base.join("safety")).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT name FROM customers WHERE id='c'").fetch_one(&live).await.unwrap(),"نسخهٔ قبلی");
        assert!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&live).await.unwrap()>before);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events WHERE operation='restore'").fetch_one(&live).await.unwrap(),1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn restoring_backup_preserves_local_accounts_instead_of_importing_them() {
        let base=std::env::temp_dir().join(format!("restore-users-{}",Uuid::new_v4()));std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES('old','old','Old','hash-old','admin')").execute(&live).await.unwrap();
        let saved=base.join("backup.sqlite3");create_backup(&live,saved.clone()).await.unwrap();
        sqlx::query("UPDATE local_users SET username='current',password_hash='hash-current' WHERE id='old'").execute(&live).await.unwrap();
        restore(&live,saved,base.join("safety")).await.unwrap();
        let row=sqlx::query("SELECT username,password_hash FROM local_users WHERE id='old'").fetch_one(&live).await.unwrap();
        assert_eq!(row.get::<String,_>(0),"current");assert_eq!(row.get::<String,_>(1),"hash-current");
        live.close().await;std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn database_upgrades_preserve_old_data() {
        for version in [1_i64, 2_i64, 3_i64, 4_i64, 5_i64, 6_i64, 7_i64, 8_i64, 9_i64, 10_i64] {
            let base = std::env::temp_dir().join(format!("farday-upgrade-{}", Uuid::new_v4()));
            std::fs::create_dir(&base).unwrap();
            let path = base.join("live.sqlite3");
            let db = open_database(path.clone()).await.unwrap();
            sqlx::query("INSERT INTO customers(id,code,name) VALUES ('c','C','مشتری')").execute(&db).await.unwrap();
            if version >= 2 { sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&db).await.unwrap(); }
            if version >= 3 { sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,payment_method) VALUES ('x','2026-01-01','مصرف',100,'cash')").execute(&db).await.unwrap(); }
            if version >= 4 { sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('s','e','miladi',2026,1,'2026-01-01',100,0,0,0,100,'cash')").execute(&db).await.unwrap(); }
            if version >= 8 {sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents) VALUES('m','2025-01-01','in','مانده',500)").execute(&db).await.unwrap();}
            if version < 10 { remove_audit(&db).await; } else { remove_users(&db).await; } if version < 9 { sqlx::query("DROP TABLE app_preferences").execute(&db).await.unwrap(); }
            if version < 8 {sqlx::query("DROP TABLE cashbox_entries").execute(&db).await.unwrap();}
            if version < 7 { sqlx::query("DROP TABLE sale_numbers").execute(&db).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&db).await.unwrap(); }
            if version < 6 { sqlx::query("DROP TABLE sale_details").execute(&db).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&db).await.unwrap(); }
            if version < 5 { sqlx::query("DROP TABLE attendance").execute(&db).await.unwrap(); }
            if version < 4 { sqlx::query("DROP TABLE salaries").execute(&db).await.unwrap(); }
            if version < 3 { sqlx::query("DROP TABLE expenses").execute(&db).await.unwrap(); }
            if version == 1 { sqlx::query("DROP TABLE employees").execute(&db).await.unwrap(); }
            sqlx::query("DELETE FROM _sqlx_migrations WHERE version>?").bind(version).execute(&db).await.unwrap();
            db.close().await;
            let upgraded = open_database(path).await.unwrap();
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM _sqlx_migrations WHERE success=1").fetch_one(&upgraded).await.unwrap(), 11);
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM customers WHERE id='c'").fetch_one(&upgraded).await.unwrap(), 1);
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&upgraded).await.unwrap(), if version >= 2 { 1 } else { 0 });
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM expenses").fetch_one(&upgraded).await.unwrap(), if version >= 3 { 1 } else { 0 });
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM salaries").fetch_one(&upgraded).await.unwrap(), if version >= 4 { 1 } else { 0 });
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM attendance").fetch_one(&upgraded).await.unwrap(), 0);
            assert_eq!(sqlx::query_scalar::<_, String>("SELECT calendar FROM app_preferences").fetch_one(&upgraded).await.unwrap(), "shamsi");
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM cashbox_entries").fetch_one(&upgraded).await.unwrap(), if version >= 8 {1} else {0});
            upgraded.close().await; std::fs::remove_dir_all(base).unwrap();
        }
    }

    #[tokio::test]
    async fn restores_v3_clearing_salaries_with_safety_backup() {
        let base=std::env::temp_dir().join(format!("farday-v3-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap(); let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&live).await.unwrap();
        let saved=base.join("v3.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_details").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE attendance").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE salaries").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=4").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('s','e','miladi',2026,1,'2026-01-01',100,0,0,0,100,'cash')").execute(&live).await.unwrap();
        let info=inspect(&live,saved.clone()).await.unwrap(); assert_eq!((info.schema_version, info.salaries), (3,0));
        let result=restore(&live,saved,base.join("safety")).await.unwrap(); assert_eq!(result.salaries,0);
        let safety=open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM salaries").fetch_one(&safety).await.unwrap(), 1);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM salaries").fetch_one(&live).await.unwrap(), 0);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn invalid_salary_date_rolls_back_and_retains_safety() {
        let base=std::env::temp_dir().join(format!("farday-invalid-salary-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap(); let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('s','e','shamsi',1404,1,'2026-01-01',100,0,0,0,100,'cash')").execute(&live).await.unwrap();
        let saved=base.join("backup.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        sqlx::query("UPDATE salaries SET pay_date='2025-02-29'").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE salaries SET notes='فعلی'").execute(&live).await.unwrap();
        assert!(restore(&live,saved,base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_, String>("SELECT notes FROM salaries").fetch_one(&live).await.unwrap(), "فعلی");
        assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(),1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn restores_v4_clearing_attendance_with_safety_backup() {
        let base=std::env::temp_dir().join(format!("farday-v4-test-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap(); sqlx::query("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')").execute(&live).await.unwrap();
        let saved=base.join("v4.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_details").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE attendance").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=5").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("INSERT INTO attendance(id,employee_id,work_date,status) VALUES('a','e','2026-01-01','present')").execute(&live).await.unwrap();
        let info=inspect(&live,saved.clone()).await.unwrap(); assert_eq!((info.schema_version,info.attendance),(4,0));
        let result=restore(&live,saved,base.join("safety")).await.unwrap(); assert_eq!(result.attendance,0);
        let safety=open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM attendance").fetch_one(&safety).await.unwrap(),1);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM attendance").fetch_one(&live).await.unwrap(),0);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn restores_v5_without_details_and_preserves_safety() {
        let base=std::env::temp_dir().join(format!("farday-v5-test-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'cash')").execute(&live).await.unwrap();
        let saved=base.join("v5.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_details").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_details").execute(&source).await.unwrap();
        sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=6").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("INSERT INTO sale_details(sale_id,bill_no) VALUES('s','BL-1')").execute(&live).await.unwrap();
        assert_eq!(inspect(&live,saved.clone()).await.unwrap().schema_version,5);
        let result=restore(&live,saved,base.join("safety")).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM sale_details").fetch_one(&live).await.unwrap(),0);
        let safety=open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT bill_no FROM sale_details").fetch_one(&safety).await.unwrap(),"BL-1");
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn restore_keeps_number_high_water_marks_and_numbers_older_backups() {
        let base=std::env::temp_dir().join(format!("farday-number-restore-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'cash')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sale_numbers(sale_id) VALUES('s')").execute(&live).await.unwrap();
        sqlx::query("UPDATE sqlite_sequence SET seq=20 WHERE name='sale_numbers'").execute(&live).await.unwrap();
        let saved=base.join("v7.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let other=open_database(base.join("other.sqlite3")).await.unwrap();
        restore(&other,saved.clone(),base.join("safety-other")).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT seq FROM sqlite_sequence WHERE name='sale_numbers'").fetch_one(&other).await.unwrap(),20); other.close().await;
        sqlx::query("UPDATE sqlite_sequence SET seq=30 WHERE name='sale_numbers'").execute(&live).await.unwrap();
        restore(&live,saved,base.join("safety")).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT number FROM sale_numbers WHERE sale_id='s'").fetch_one(&live).await.unwrap(),1);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT seq FROM sqlite_sequence WHERE name='sale_numbers'").fetch_one(&live).await.unwrap(),30);
        let old=base.join("v6.sqlite3"); create_backup(&live,old.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&old)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE sale_numbers").execute(&source).await.unwrap(); sqlx::query("DROP TABLE receipt_numbers").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=7").execute(&source).await.unwrap(); source.close().await;
        assert_eq!(inspect(&live,old.clone()).await.unwrap().schema_version,6);
        restore(&live,old,base.join("safety")).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT number FROM sale_numbers WHERE sale_id='s'").fetch_one(&live).await.unwrap(),31);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn rejects_backup_with_number_counter_below_issued_number() {
        let base=std::env::temp_dir().join(format!("farday-number-corrupt-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-01','ریگ',1000,100,0,100,'cash')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO sale_numbers(sale_id) VALUES('s')").execute(&live).await.unwrap();
        let saved=base.join("backup.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        sqlx::query("UPDATE sqlite_sequence SET seq=0 WHERE name='sale_numbers'").execute(&source).await.unwrap(); source.close().await;
        assert!(inspect(&live,saved.clone()).await.is_err()); assert!(restore(&live,saved,base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT number FROM sale_numbers").fetch_one(&live).await.unwrap(),1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn older_backup_clears_cashbox_but_safety_keeps_it() {
        let base=std::env::temp_dir().join(format!("farday-v7-cashbox-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        let saved=base.join("v7.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap();
        sqlx::query("DROP TABLE cashbox_entries").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=8").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents) VALUES('m','2025-01-01','in','مانده',500)").execute(&live).await.unwrap();
        let info=inspect(&live,saved.clone()).await.unwrap(); assert_eq!((info.schema_version,info.cashbox),(7,0));
        let result=restore(&live,saved,base.join("safety")).await.unwrap(); assert_eq!(result.cashbox,0);
        let safety=open_source(Path::new(&result.safety_backup)).await.unwrap();
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM cashbox_entries").fetch_one(&safety).await.unwrap(),1);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM cashbox_entries").fetch_one(&live).await.unwrap(),0);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn v8_backup_resets_calendar_and_safety_preserves_previous_choice() {
        let base=std::env::temp_dir().join(format!("farday-v8-pref-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents) VALUES('m','2025-01-01','in','نقد',500)").execute(&live).await.unwrap();
        let saved=base.join("v8.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        remove_audit(&source).await; sqlx::query("DROP TABLE app_preferences").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version>=9").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE app_preferences SET calendar='miladi'").execute(&live).await.unwrap();
        let info=inspect(&live,saved.clone()).await.unwrap(); assert_eq!((info.schema_version,info.cashbox,info.calendar.as_str()),(8,1,"shamsi"));
        let result=restore(&live,saved,base.join("safety")).await.unwrap(); assert_eq!(result.calendar,"shamsi");
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT calendar FROM app_preferences").fetch_one(&live).await.unwrap(),"shamsi");
        let safety=open_source(Path::new(&result.safety_backup)).await.unwrap(); assert_eq!(sqlx::query_scalar::<_,String>("SELECT calendar FROM app_preferences").fetch_one(&safety).await.unwrap(),"miladi");
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM cashbox_entries").fetch_one(&live).await.unwrap(),1);
        safety.close().await; live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn rejects_backup_with_missing_calendar_setting() {
        let base=std::env::temp_dir().join(format!("farday-pref-invalid-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap(); let saved=base.join("invalid.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap(); sqlx::query("DELETE FROM app_preferences").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE app_preferences SET calendar='miladi'").execute(&live).await.unwrap();
        assert!(inspect(&live,saved.clone()).await.is_err()); assert!(restore(&live,saved,base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT calendar FROM app_preferences").fetch_one(&live).await.unwrap(),"miladi");
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn invalid_cashbox_date_rolls_back_with_safety_backup() {
        let base=std::env::temp_dir().join(format!("farday-cashbox-invalid-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents) VALUES('m','2025-01-01','in','معتبر',500)").execute(&live).await.unwrap();
        let saved=base.join("backup.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        sqlx::query("UPDATE cashbox_entries SET entry_date='2025-02-29'").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE cashbox_entries SET description='فعلی'").execute(&live).await.unwrap();
        assert!(restore(&live,saved,base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT description FROM cashbox_entries").fetch_one(&live).await.unwrap(),"فعلی");
        assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(),1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }
    #[tokio::test]
    async fn invalid_attendance_time_rolls_back_with_safety_backup() {
        let base=std::env::temp_dir().join(format!("farday-attendance-invalid-{}",Uuid::new_v4())); std::fs::create_dir(&base).unwrap();
        let live=open_database(base.join("live.sqlite3")).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO attendance(id,employee_id,work_date,status,check_in) VALUES('a','e','2026-01-01','present','08:00')").execute(&live).await.unwrap();
        let saved=base.join("backup.sqlite3"); create_backup(&live,saved.clone()).await.unwrap();
        let source=SqlitePoolOptions::new().connect_with(SqliteConnectOptions::new().filename(&saved)).await.unwrap();
        sqlx::query("UPDATE attendance SET check_in='25:00'").execute(&source).await.unwrap(); source.close().await;
        sqlx::query("UPDATE attendance SET notes='فعلی'").execute(&live).await.unwrap();
        assert!(restore(&live,saved,base.join("safety")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT notes FROM attendance").fetch_one(&live).await.unwrap(),"فعلی");
        assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(),1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

}
