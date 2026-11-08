//! Conservative restore for the first four desktop schemas only.
//! Source rows are copied as values, never executed as SQL. The target stays in a
//! single write transaction, and a verified snapshot is made while writes are locked.
use futures_util::TryStreamExt;
use serde::Serialize;
use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, Row, SqliteConnection, SqlitePool};
use std::path::{Path, PathBuf};
use uuid::Uuid;
use crate::service::create_backup;

const SCHEMA_VERSION: i64 = 4;
const MAX_SCALED: i64 = 1_000_000_000_000;
const MAX_BACKUP_BYTES: u64 = 1024 * 1024 * 1024;
const TABLES: [&str; 4] = ["_sqlx_migrations", "customers", "sales", "receipts"];

#[derive(Serialize)]
pub(crate) struct BackupInfo { schema_version: i64, customers: i64, sales: i64, receipts: i64, employees: i64, expenses: i64, salaries: i64 }
#[derive(Serialize)]
pub(crate) struct RestoreResult { safety_backup: String, customers: i64, sales: i64, receipts: i64, employees: i64, expenses: i64, salaries: i64 }

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
    for table in TABLES.iter().copied().chain(if supplied.len() >= 2 { Some("employees") } else { None }).chain(if supplied.len() >= 3 { Some("expenses") } else { None }).chain(if supplied.len() >= 4 { Some("salaries") } else { None }) {
        let schema = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?";
        let expected: Option<String> = sqlx::query_scalar(schema).bind(table).fetch_optional(&mut *target).await.map_err(error)?;
        let actual: Option<String> = sqlx::query_scalar(schema).bind(table).fetch_optional(&mut *source).await.map_err(error)?;
        if expected.is_none() || expected != actual {
            return Err("ساختار فایل پشتیبان با این نسخه سازگار نیست.".into());
        }
    }
    // An older backup must not contain later tables that would be silently ignored.
    for (version, table) in [(2, "employees"), (3, "expenses"), (4, "salaries")] {
        if supplied.len() < version {
            let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?").bind(table).fetch_one(&mut *source).await.map_err(error)?;
            if exists != 0 { return Err("نسخه و ساختار فایل پشتیبان هماهنگ نیست.".into()); }
        }
    }
    let checks: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&mut *source).await.map_err(error)?;
    if checks.len() != 1 || checks[0] != "ok" || !sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut *source).await.map_err(error)?.is_empty() {
        return Err("فایل پشتیبان خراب است یا ارتباطات معتبر ندارد.".into());
    }
    let customers: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&mut *source).await.map_err(error)?;
    let sales: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sales").fetch_one(&mut *source).await.map_err(error)?;
    let receipts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM receipts").fetch_one(&mut *source).await.map_err(error)?;
    let employees = if supplied.len() >= 2 { sqlx::query_scalar("SELECT COUNT(*) FROM employees").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let expenses = if supplied.len() >= 3 { sqlx::query_scalar("SELECT COUNT(*) FROM expenses").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    let salaries = if supplied.len() >= 4 { sqlx::query_scalar("SELECT COUNT(*) FROM salaries").fetch_one(&mut *source).await.map_err(error)? } else { 0 };
    Ok(BackupInfo { schema_version: supplied.len() as i64, customers, sales, receipts, employees, expenses, salaries })
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
        for sql in ["DELETE FROM salaries", "DELETE FROM receipts", "DELETE FROM sales", "DELETE FROM customers", "DELETE FROM employees", "DELETE FROM expenses"] {
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
    Ok(RestoreResult { safety_backup: safety_path.to_string_lossy().into_owned(), customers: info.customers, sales: info.sales, receipts: info.receipts, employees: info.employees, expenses: info.expenses, salaries: info.salaries })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::open_database;

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
        sqlx::query("INSERT INTO employees(id,code,name,base_salary_cents) VALUES ('e1','E1','کارمند',120000)").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES ('x1','2026-01-01','تیل',100,200,'cash')").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES ('p1','e1','shamsi',1404,1,'2026-01-01',100,10,5,0,105,'cash')").execute(&live).await.unwrap();
        create_backup(&live, saved.clone()).await.unwrap();
        sqlx::query("DELETE FROM salaries").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM expenses").execute(&live).await.unwrap();
        sqlx::query("DELETE FROM employees").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('c2','C2','دوم')").execute(&live).await.unwrap();
        let preview = inspect(&live, saved.clone()).await.unwrap();
        assert_eq!((preview.customers, preview.sales, preview.receipts, preview.employees, preview.expenses, preview.salaries, preview.schema_version), (1, 1, 1, 1, 1, 1, 4));
        let result = restore(&live, saved.clone(), base.join("safety")).await.unwrap();
        assert_eq!((result.customers, result.sales, result.receipts, result.employees, result.expenses, result.salaries), (1, 1, 1, 1, 1, 1));
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&live).await.unwrap(), 1);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT amount_usd_cents FROM expenses").fetch_one(&live).await.unwrap(), 200);
        assert_eq!(sqlx::query_scalar::<_, i64>("SELECT total_cents FROM salaries").fetch_one(&live).await.unwrap(), 105);
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
        sqlx::query("DELETE FROM customers").execute(&live).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES ('new','NEW','فعلی')").execute(&live).await.unwrap();
        sqlx::query("CREATE TRIGGER reject_old BEFORE INSERT ON customers WHEN NEW.id='old' BEGIN SELECT RAISE(ABORT,'forced test error'); END").execute(&live).await.unwrap();
        let result = restore(&live, saved, base.join("safety")).await;
        assert!(result.is_err());
        let id: String = sqlx::query_scalar("SELECT id FROM customers").fetch_one(&live).await.unwrap();
        assert_eq!(id, "new");
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
        assert!(restore(&live, saved, base.join("safety")).await.is_err());
        let description: String = sqlx::query_scalar("SELECT description FROM expenses WHERE id='x'").fetch_one(&live).await.unwrap();
        assert_eq!(description, "فعلی"); assert_eq!(std::fs::read_dir(base.join("safety")).unwrap().count(), 1);
        live.close().await; std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn database_upgrades_preserve_v1_and_v2_data() {
        for version in [1_i64, 2_i64, 3_i64] {
            let base = std::env::temp_dir().join(format!("farday-upgrade-{}", Uuid::new_v4()));
            std::fs::create_dir(&base).unwrap();
            let path = base.join("live.sqlite3");
            let db = open_database(path.clone()).await.unwrap();
            sqlx::query("INSERT INTO customers(id,code,name) VALUES ('c','C','مشتری')").execute(&db).await.unwrap();
            if version >= 2 { sqlx::query("INSERT INTO employees(id,code,name) VALUES ('e','E','کارمند')").execute(&db).await.unwrap(); }
            if version >= 3 { sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,payment_method) VALUES ('x','2026-01-01','مصرف',100,'cash')").execute(&db).await.unwrap(); }
            sqlx::query("DROP TABLE salaries").execute(&db).await.unwrap();
            if version < 3 { sqlx::query("DROP TABLE expenses").execute(&db).await.unwrap(); }
            if version == 1 { sqlx::query("DROP TABLE employees").execute(&db).await.unwrap(); }
            sqlx::query("DELETE FROM _sqlx_migrations WHERE version>?").bind(version).execute(&db).await.unwrap();
            db.close().await;
            let upgraded = open_database(path).await.unwrap();
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM _sqlx_migrations WHERE success=1").fetch_one(&upgraded).await.unwrap(), 4);
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM customers WHERE id='c'").fetch_one(&upgraded).await.unwrap(), 1);
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM employees").fetch_one(&upgraded).await.unwrap(), if version >= 2 { 1 } else { 0 });
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM expenses").fetch_one(&upgraded).await.unwrap(), if version >= 3 { 1 } else { 0 });
            assert_eq!(sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM salaries").fetch_one(&upgraded).await.unwrap(), 0);
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
        sqlx::query("DROP TABLE salaries").execute(&source).await.unwrap(); sqlx::query("DELETE FROM _sqlx_migrations WHERE version=4").execute(&source).await.unwrap(); source.close().await;
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

}
