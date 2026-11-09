use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, Row, SqlitePool, SqliteConnection};
use std::path::PathBuf;
use uuid::Uuid;

const MAX: i128 = 1_000_000_000_000;

#[derive(Deserialize)]
pub(crate) struct CustomerInput { code: String, name: String, phone: String, opening: String }
#[derive(Deserialize)]
pub(crate) struct SaleInput { customer_id: String, date: String, material: String, volume: String, unit_price: String, freight: String, payment_type: String, #[serde(default)] details: SaleDetails }
#[derive(Deserialize)]
pub(crate) struct ReceiptInput { customer_id: String, date: String, amount: String, source: String, #[serde(default)] details: ReceiptDetails }
#[derive(Deserialize, Serialize, Clone, Default, PartialEq, Eq, Debug)]
#[serde(default)]
pub(crate) struct SaleDetails { pub(crate) bill_no:String, pub(crate) driver_name:String, pub(crate) vehicle_plate:String, pub(crate) destination:String, pub(crate) notes:String }
#[derive(Deserialize, Serialize, Clone, Default, PartialEq, Eq, Debug)]
#[serde(default)]
pub(crate) struct ReceiptDetails { pub(crate) related_bill_no:String, pub(crate) received_by:String, pub(crate) notes:String }
fn text(value:&str,limit:usize)->Result<String,String> {
    let value=value.trim(); if value.len()>limit {return Err("متن واردشده بیش از حد طولانی است.".into());} Ok(value.into())
}
impl SaleDetails {
    fn normalized(&self)->Result<Self,String> { Ok(Self {bill_no:text(&self.bill_no,160)?,driver_name:text(&self.driver_name,320)?,vehicle_plate:text(&self.vehicle_plate,160)?,destination:text(&self.destination,320)?,notes:text(&self.notes,4000)?}) }
}
impl ReceiptDetails {
    fn normalized(&self)->Result<Self,String> { Ok(Self {related_bill_no:text(&self.related_bill_no,160)?,received_by:text(&self.received_by,320)?,notes:text(&self.notes,4000)?}) }
}
async fn sale_details(db:&mut SqliteConnection,id:&str)->Result<SaleDetails,String> {
    let row=sqlx::query("SELECT bill_no,driver_name,vehicle_plate,destination,notes FROM sale_details WHERE sale_id=?").bind(id).fetch_optional(db).await.map_err(db_error)?;
    match row { Some(r)=>Ok(SaleDetails {bill_no:r.try_get(0).map_err(db_error)?,driver_name:r.try_get(1).map_err(db_error)?,vehicle_plate:r.try_get(2).map_err(db_error)?,destination:r.try_get(3).map_err(db_error)?,notes:r.try_get(4).map_err(db_error)?}),None=>Ok(SaleDetails::default()) }
}
async fn receipt_details(db:&mut SqliteConnection,id:&str)->Result<ReceiptDetails,String> {
    let row=sqlx::query("SELECT related_bill_no,received_by,notes FROM receipt_details WHERE receipt_id=?").bind(id).fetch_optional(db).await.map_err(db_error)?;
    match row { Some(r)=>Ok(ReceiptDetails {related_bill_no:r.try_get(0).map_err(db_error)?,received_by:r.try_get(1).map_err(db_error)?,notes:r.try_get(2).map_err(db_error)?}),None=>Ok(ReceiptDetails::default()) }
}
async fn write_sale_details(db:&mut SqliteConnection,id:&str,d:&SaleDetails)->Result<(),String> {
    sqlx::query("INSERT INTO sale_details(sale_id,bill_no,driver_name,vehicle_plate,destination,notes) VALUES(?,?,?,?,?,?) ON CONFLICT(sale_id) DO UPDATE SET bill_no=excluded.bill_no,driver_name=excluded.driver_name,vehicle_plate=excluded.vehicle_plate,destination=excluded.destination,notes=excluded.notes")
        .bind(id).bind(&d.bill_no).bind(&d.driver_name).bind(&d.vehicle_plate).bind(&d.destination).bind(&d.notes).execute(db).await.map_err(db_error)?; Ok(())
}
async fn write_receipt_details(db:&mut SqliteConnection,id:&str,d:&ReceiptDetails)->Result<(),String> {
    sqlx::query("INSERT INTO receipt_details(receipt_id,related_bill_no,received_by,notes) VALUES(?,?,?,?) ON CONFLICT(receipt_id) DO UPDATE SET related_bill_no=excluded.related_bill_no,received_by=excluded.received_by,notes=excluded.notes")
        .bind(id).bind(&d.related_bill_no).bind(&d.received_by).bind(&d.notes).execute(db).await.map_err(db_error)?; Ok(())
}
#[derive(Serialize)]
struct Customer { id: String, code: String, name: String, phone: String, opening: String, balance: String }
#[derive(Serialize)]
struct Entry { id: String, kind: String, date: String, customer_name: String, detail: String, amount: String }
#[derive(Serialize)]
pub(crate) struct Snapshot { customers: Vec<Customer>, entries: Vec<Entry>, credit_sales: String, receipts: String, total_balance: String }

pub(crate) fn scaled(raw: &str, decimals: u32) -> Result<i64, String> {
    let normalized: String = raw.trim().chars().filter_map(|c| match c {
        '۰'..='۹' => char::from_u32('0' as u32 + c as u32 - '۰' as u32),
        '٠'..='٩' => char::from_u32('0' as u32 + c as u32 - '٠' as u32),
        ',' | '٬' | ' ' => None,
        _ => Some(c),
    }).collect();
    let mut parts = normalized.split('.');
    let whole = parts.next().unwrap_or("");
    let fraction = parts.next();
    if parts.next().is_some() || whole.is_empty() || !whole.bytes().all(|b| b.is_ascii_digit()) ||
        fraction.is_some_and(|f| f.is_empty() || f.len() > decimals as usize || !f.bytes().all(|b| b.is_ascii_digit())) {
        return Err(format!("عدد معتبر با حداکثر {decimals} رقم اعشار وارد کنید."));
    }
    let power = 10_i128.pow(decimals);
    let integer = whole.parse::<i128>().map_err(|_| "عدد واردشده بیش از حد مجاز است.")?;
    let f = fraction.unwrap_or("");
    let fractional = if f.is_empty() { 0 } else { f.parse::<i128>().map_err(|_| "عدد نامعتبر است.")? * 10_i128.pow(decimals - f.len() as u32) };
    let value = integer.checked_mul(power).and_then(|v| v.checked_add(fractional)).ok_or("عدد واردشده بیش از حد مجاز است.")?;
    if value > MAX { return Err("عدد واردشده بیش از حد مجاز است.".into()); }
    Ok(value as i64)
}
pub(crate) fn money(value: i64) -> String {
    let value = value as i128;
    format!("{}{}.{:02}", if value < 0 { "-" } else { "" }, value.abs() / 100, value.abs() % 100)
}
pub(crate) fn valid_date(date: &str) -> Result<(), String> {
    let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| "تاریخ میلادی معتبر وارد کنید.")?;
    if parsed.year() < 1 || parsed.to_string() != date { return Err("تاریخ میلادی معتبر وارد کنید.".into()); }
    Ok(())
}
use chrono::Datelike;
fn calculate_sale(volume: &str, price: &str, freight: &str) -> Result<(i64, i64, i64, i64), String> {
    let v = scaled(volume, 3)?;
    let p = scaled(price, 2)?;
    let f = scaled(freight, 2)?;
    if v == 0 { return Err("متراژ باید بیشتر از صفر باشد.".into()); }
    let total = ((v as i128) * ((p as i128) + (f as i128)) + 500) / 1000;
    if total > MAX { return Err("مجموع فروش بیش از حد مجاز است.".into()); }
    Ok((v, p, f, total as i64))
}
fn db_error(err: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref e) = err {
        if e.is_unique_violation() { return "کد مشتری قبلاً ثبت شده است.".into(); }
        if e.is_foreign_key_violation() { return "مشتری انتخاب‌شده وجود ندارد.".into(); }
    }
    eprintln!("Database error: {err}");
    "عملیات دیتابیس انجام نشد. لطفاً دوباره تلاش کنید.".into()
}

fn validate_customer(input: &CustomerInput) -> Result<i64, String> {
    if input.code.trim().is_empty() || input.name.trim().is_empty() { return Err("کد و نام مشتری الزامی است.".into()); }
    if input.code.trim().len() > 80 || input.name.trim().len() > 320 || input.phone.trim().len() > 120 { return Err("متن واردشده بیش از حد طولانی است.".into()); }
    scaled(&input.opening, 2)
}

pub(crate) async fn add_customer(db: &SqlitePool, input: CustomerInput) -> Result<(), String> {
    let opening = validate_customer(&input)?;
    sqlx::query("INSERT INTO customers (id, code, name, phone, opening_cents) VALUES (?, ?, ?, ?, ?)")
        .bind(Uuid::new_v4().to_string()).bind(input.code.trim()).bind(input.name.trim()).bind(input.phone.trim()).bind(opening)
        .execute(db).await.map_err(db_error)?;
    Ok(())
}

pub(crate) async fn update_customer(db: &SqlitePool, id: String, input: CustomerInput) -> Result<(), String> {
    let opening = validate_customer(&input)?;
    let changed = sqlx::query("UPDATE customers SET code=?,name=?,phone=?,opening_cents=? WHERE id=?")
        .bind(input.code.trim()).bind(input.name.trim()).bind(input.phone.trim()).bind(opening).bind(id)
        .execute(db).await.map_err(db_error)?.rows_affected();
    if changed == 0 { return Err("مشتری انتخاب‌شده وجود ندارد.".into()); }
    Ok(())
}

fn validate_sale(input: &SaleInput) -> Result<(i64,i64,i64,i64), String> {
    valid_date(&input.date)?;
    let material = input.material.trim();
    if material.is_empty() || material.len() > 200 { return Err("نوع مواد معتبر وارد کنید.".into()); }
    if !matches!(input.payment_type.as_str(), "cash" | "credit") { return Err("نوع پرداخت معتبر نیست.".into()); }
    calculate_sale(&input.volume, &input.unit_price, &input.freight)
}
fn validate_receipt(input: &ReceiptInput) -> Result<i64, String> {
    valid_date(&input.date)?;
    let amount = scaled(&input.amount, 2)?;
    if amount == 0 { return Err("مبلغ رسید باید بیشتر از صفر باشد.".into()); }
    if !matches!(input.source.as_str(), "debt" | "deposit" | "statement" | "advance") { return Err("منبع رسید معتبر نیست.".into()); }
    Ok(amount)
}
pub(crate) async fn add_sale(db: &SqlitePool, input: SaleInput) -> Result<(), String> {
    let (volume, price, freight, total) = validate_sale(&input)?; let details=input.details.normalized()?; let id=Uuid::new_v4().to_string();
    let mut tx=db.begin().await.map_err(db_error)?;
    sqlx::query("INSERT INTO sales (id, customer_id, sale_date, material, volume_milli, unit_price_cents, freight_cents, total_cents, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(input.customer_id).bind(input.date).bind(input.material.trim()).bind(volume).bind(price).bind(freight).bind(total).bind(input.payment_type)
        .execute(&mut *tx).await.map_err(db_error)?;
    write_sale_details(&mut tx,&id,&details).await?; tx.commit().await.map_err(db_error)?; Ok(())
}
pub(crate) async fn add_receipt(db: &SqlitePool, input: ReceiptInput) -> Result<(), String> {
    let amount=validate_receipt(&input)?; let details=input.details.normalized()?; let id=Uuid::new_v4().to_string(); let mut tx=db.begin().await.map_err(db_error)?;
    sqlx::query("INSERT INTO receipts (id, customer_id, receipt_date, amount_cents, source) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(input.customer_id).bind(input.date).bind(amount).bind(input.source).execute(&mut *tx).await.map_err(db_error)?;
    write_receipt_details(&mut tx,&id,&details).await?; tx.commit().await.map_err(db_error)?; Ok(())
}
/// A write lock protects comparison of both the base row and supplemental fields.
pub(crate) async fn update_sale(db: &SqlitePool, id: String, input: SaleInput, expected: SaleInput) -> Result<(), String> {
    let (volume,price,freight,total)=validate_sale(&input)?;
    let (old_volume,old_price,old_freight,old_total)=validate_sale(&expected)?;
    let details=input.details.normalized()?; let old_details=expected.details.clone();
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(db_error)?;
    if sale_details(&mut tx,&id).await? != old_details { return Err("فروش تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.".into()); }
    let n=sqlx::query("UPDATE sales SET customer_id=?,sale_date=?,material=?,volume_milli=?,unit_price_cents=?,freight_cents=?,total_cents=?,payment_type=? WHERE id=? AND customer_id=? AND sale_date=? AND material=? AND volume_milli=? AND unit_price_cents=? AND freight_cents=? AND total_cents=? AND payment_type=?")
        .bind(input.customer_id).bind(input.date).bind(input.material.trim()).bind(volume).bind(price).bind(freight).bind(total).bind(input.payment_type).bind(&id)
        .bind(expected.customer_id).bind(expected.date).bind(expected.material.trim()).bind(old_volume).bind(old_price).bind(old_freight).bind(old_total).bind(expected.payment_type).execute(&mut *tx).await.map_err(db_error)?.rows_affected();
    if n==0 { return Err("فروش تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.".into()); }
    write_sale_details(&mut tx,&id,&details).await?; tx.commit().await.map_err(db_error)?; Ok(())
}
pub(crate) async fn update_receipt(db: &SqlitePool, id: String, input: ReceiptInput, expected: ReceiptInput) -> Result<(), String> {
    let amount=validate_receipt(&input)?; let old_amount=validate_receipt(&expected)?;
    let details=input.details.normalized()?; let old_details=expected.details.clone();
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(db_error)?;
    if receipt_details(&mut tx,&id).await? != old_details { return Err("رسید تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.".into()); }
    let n=sqlx::query("UPDATE receipts SET customer_id=?,receipt_date=?,amount_cents=?,source=? WHERE id=? AND customer_id=? AND receipt_date=? AND amount_cents=? AND source=?")
        .bind(input.customer_id).bind(input.date).bind(amount).bind(input.source).bind(&id).bind(expected.customer_id).bind(expected.date).bind(old_amount).bind(expected.source).execute(&mut *tx).await.map_err(db_error)?.rows_affected();
    if n==0 { return Err("رسید تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.".into()); }
    write_receipt_details(&mut tx,&id,&details).await?; tx.commit().await.map_err(db_error)?; Ok(())
}

pub(crate) async fn snapshot(db: &SqlitePool) -> Result<Snapshot, String> {
    // A read transaction ensures all totals and rows are from the same database snapshot.
    let mut tx = db.begin().await.map_err(db_error)?;
    let rows = sqlx::query("SELECT c.id, c.code, c.name, c.phone, c.opening_cents, c.opening_cents + COALESCE((SELECT SUM(s.total_cents) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='credit'),0) - COALESCE((SELECT SUM(r.amount_cents) FROM receipts r WHERE r.customer_id=c.id AND r.source <> 'deposit'),0) AS balance FROM customers c ORDER BY c.name, c.id")
        .fetch_all(&mut *tx).await.map_err(db_error)?;
    let mut customers = Vec::new(); let mut balance: i128 = 0;
    for r in rows {
        let b: i64 = r.try_get("balance").map_err(db_error)?; balance += b as i128;
        customers.push(Customer { id: r.get("id"), code: r.get("code"), name: r.get("name"), phone: r.get("phone"), opening: money(r.get("opening_cents")), balance: money(b) });
    }
    let balance: i64 = balance.try_into().map_err(|_| "مجموع بدهی بیش از حد مجاز است.".to_string())?;
    let credit: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(total_cents),0) FROM sales WHERE payment_type='credit'").fetch_one(&mut *tx).await.map_err(db_error)?;
    let receipts: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(amount_cents),0) FROM receipts").fetch_one(&mut *tx).await.map_err(db_error)?;
    let rows = sqlx::query("SELECT s.id AS id, 'sale' AS kind, s.sale_date AS date, c.name AS customer_name, s.material || ' · ' || CASE s.payment_type WHEN 'credit' THEN 'باقی' ELSE 'نقده' END AS detail, s.total_cents AS amount, s.created_at AS created_at FROM sales s JOIN customers c ON c.id=s.customer_id UNION ALL SELECT r.id, 'receipt', r.receipt_date, c.name, CASE r.source WHEN 'debt' THEN 'باقی داری' WHEN 'deposit' THEN 'امانت' WHEN 'statement' THEN 'بیانیه' ELSE 'پیش پرداخت' END, r.amount_cents, r.created_at FROM receipts r JOIN customers c ON c.id=r.customer_id ORDER BY date DESC, created_at DESC, id DESC LIMIT 100")
        .fetch_all(&mut *tx).await.map_err(db_error)?;
    let entries = rows.into_iter().map(|r| Entry { id: r.get("id"), kind: r.get("kind"), date: r.get("date"), customer_name: r.get("customer_name"), detail: r.get("detail"), amount: money(r.get("amount")) }).collect();
    tx.commit().await.map_err(db_error)?;
    Ok(Snapshot { customers, entries, credit_sales: money(credit), receipts: money(receipts), total_balance: money(balance) })
}

#[derive(Serialize)]
pub(crate) struct Ledger {
    customer_name: String,
    customer_code: String,
    opening: String,
    balance: String,
    rows: Vec<LedgerRow>,
}
#[derive(Serialize)]
struct LedgerRow {
    id: String,
    date: String,
    kind: String,
    detail: String,
    debit: String,
    credit: String,
    affects_balance: bool,
    balance: String,
}

pub(crate) async fn customer_ledger(db: &SqlitePool, customer_id: String) -> Result<Ledger, String> {
    let mut tx = db.begin().await.map_err(db_error)?;
    let customer = sqlx::query("SELECT name, code, opening_cents FROM customers WHERE id=?")
        .bind(&customer_id).fetch_optional(&mut *tx).await.map_err(db_error)?
        .ok_or("مشتری انتخاب‌شده وجود ندارد.")?;
    let opening: i64 = customer.try_get("opening_cents").map_err(db_error)?;
    // Cash sales are not part of a debt ledger. All receipts are shown; deposit
    // receipts are explicitly marked as informational and do not reduce debt.
    let events = sqlx::query("SELECT s.id AS id, s.sale_date AS date, 'sale' AS kind, s.material AS detail, s.total_cents AS amount, 1 AS affects, s.created_at AS created FROM sales s WHERE s.customer_id=? AND s.payment_type='credit' UNION ALL SELECT r.id, r.receipt_date, 'receipt', CASE r.source WHEN 'debt' THEN 'باقی داری' WHEN 'deposit' THEN 'امانت' WHEN 'statement' THEN 'بیانیه' ELSE 'پیش پرداخت' END, r.amount_cents, CASE WHEN r.source='deposit' THEN 0 ELSE 1 END, r.created_at FROM receipts r WHERE r.customer_id=? ORDER BY date ASC, created ASC, id ASC")
        .bind(&customer_id).bind(&customer_id).fetch_all(&mut *tx).await.map_err(db_error)?;
    let mut running = opening as i128;
    let mut rows = Vec::with_capacity(events.len());
    for event in events {
        let kind: String = event.try_get("kind").map_err(db_error)?;
        let amount: i64 = event.try_get("amount").map_err(db_error)?;
        let affects = event.try_get::<i64, _>("affects").map_err(db_error)? != 0;
        let (debit, credit) = if kind == "sale" { (amount, 0) } else { (0, amount) };
        if affects { running += debit as i128 - credit as i128; }
        let balance: i64 = running.try_into().map_err(|_| "ماندهٔ حساب بیش از حد مجاز است.".to_string())?;
        rows.push(LedgerRow { id: event.get("id"), date: event.get("date"), kind,
            detail: event.get("detail"), debit: money(debit), credit: money(credit),
            affects_balance: affects, balance: money(balance) });
    }
    tx.commit().await.map_err(db_error)?;
    let balance: i64 = running.try_into().map_err(|_| "ماندهٔ حساب بیش از حد مجاز است.".to_string())?;
    Ok(Ledger { customer_name: customer.get("name"), customer_code: customer.get("code"),
        opening: money(opening), balance: money(balance), rows })
}

/// Export a consistent SQLite snapshot into a new file. Never replace an existing file.
/// This is export only; no restore operation is performed here.
pub(crate) async fn create_backup(db: &SqlitePool, path: PathBuf) -> Result<(), String> {
    if !path.is_absolute() || path.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()).as_deref() != Some("sqlite3") {
        return Err("مسیر کامل فایل با پسوند sqlite3 را انتخاب کنید.".into());
    }
    let path_text = path.to_str().ok_or("مسیر فایل معتبر نیست.")?;
    // Reserve the destination atomically; this also rejects symlinks and existing files.
    let placeholder = std::fs::OpenOptions::new().write(true).create_new(true).open(&path)
        .map_err(|e| if e.kind() == std::io::ErrorKind::AlreadyExists {
            "این فایل قبلاً وجود دارد؛ نام دیگری انتخاب کنید.".to_string()
        } else { "فایل پشتیبان ایجاد نشد؛ مسیر و اجازهٔ نوشتن را بررسی کنید.".to_string() })?;
    drop(placeholder);
    let result = async {
        // VACUUM INTO works with an empty reserved file and produces a consistent
        // snapshot without copying a potentially live WAL file.
        sqlx::query("VACUUM INTO ?").bind(path_text).execute(db).await.map_err(db_error)?;
        let options = SqliteConnectOptions::new().filename(&path).read_only(true).foreign_keys(true);
        let backup = SqlitePoolOptions::new().max_connections(1).connect_with(options).await.map_err(db_error)?;
        let verification = async {
            let checks: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&backup).await.map_err(db_error)?;
            if checks.len() != 1 || checks[0] != "ok" {
                return Err("بررسی صحت فایل پشتیبان ناموفق بود.".to_string());
            }
            if !sqlx::query("PRAGMA foreign_key_check").fetch_all(&backup).await.map_err(db_error)?.is_empty() {
                return Err("ارتباطات فایل پشتیبان معتبر نیست.".to_string());
            }
            Ok(())
        }.await;
        backup.close().await;
        verification
    }.await;
    if result.is_err() {
        // The file was created by this operation; a partial export is not a backup.
        let _ = std::fs::remove_file(&path);
    }
    result
}

pub(crate) async fn open_database(path: PathBuf) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let options = SqliteConnectOptions::new().filename(path).create_if_missing(true).foreign_keys(true);
    let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
    sqlx::migrate!().run(&pool).await?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn exact_sale_and_receipt_values() {
        assert_eq!(calculate_sale("10", "500", "300").unwrap().3, 800_000);
        assert_eq!(calculate_sale("0.005", "1", "0").unwrap().3, 1);
        assert_eq!(scaled("۱٬۲۳۴.۵۰", 2).unwrap(), 123450);
        assert!(scaled("1.001", 2).is_err());
        assert!(calculate_sale("0", "1", "0").is_err());
    }
    #[test] fn validates_dates() { assert!(valid_date("2024-02-29").is_ok()); assert!(valid_date("2025-02-29").is_err()); }
    #[tokio::test]
    async fn sqlite_workflow_persists_and_ledger_matches_snapshot() {
        let path = std::env::temp_dir().join(format!("farday-test-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        add_customer(&db, CustomerInput { code: "C-1".into(), name: "مشتری".into(), phone: "".into(), opening: "100".into() }).await.unwrap();
        assert!(add_customer(&db, CustomerInput { code: "c-1".into(), name: "دوباره".into(), phone: "".into(), opening: "0".into() }).await.is_err());
        let first = snapshot(&db).await.unwrap();
        let id = first.customers[0].id.clone();
        add_sale(&db, SaleInput { customer_id: id.clone(), date: "2026-01-01".into(), material: "ریگ".into(), volume: "10".into(), unit_price: "500".into(), freight: "300".into(), payment_type: "credit".into(), details:SaleDetails::default() }).await.unwrap();
        add_sale(&db, SaleInput { customer_id: id.clone(), date: "2026-01-02".into(), material: "ریگ".into(), volume: "1".into(), unit_price: "50".into(), freight: "0".into(), payment_type: "cash".into(), details:SaleDetails::default() }).await.unwrap();
        for (date, amount, source) in [("2026-01-03", "1000", "debt"), ("2026-01-04", "500", "deposit")] {
            add_receipt(&db, ReceiptInput { customer_id: id.clone(), date: date.into(), amount: amount.into(), source: source.into(), details:ReceiptDetails::default() }).await.unwrap();
        }
        assert!(add_receipt(&db, ReceiptInput { customer_id: "missing".into(), date: "2026-01-05".into(), amount: "1".into(), source: "debt".into(), details:ReceiptDetails::default() }).await.is_err());
        db.close().await;
        let db = open_database(path.clone()).await.unwrap();
        let snapshot = snapshot(&db).await.unwrap();
        let ledger = customer_ledger(&db, id).await.unwrap();
        assert_eq!(snapshot.customers[0].balance, "7100.00");
        assert_eq!(ledger.balance, snapshot.customers[0].balance);
        assert_eq!(ledger.opening, "100.00");
        assert_eq!(ledger.rows.len(), 3); // Cash sale is not a debt movement.
        assert!(!ledger.rows[2].affects_balance); // Deposit stays visible but does not alter debt.
        assert_eq!(ledger.rows[1].balance, ledger.rows[2].balance);
        db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn backup_is_consistent_and_never_overwrites() {
        let base = std::env::temp_dir().join(format!("farday-backup-test-{}", Uuid::new_v4()));
        std::fs::create_dir(&base).unwrap();
        let live = base.join("live.sqlite3");
        let saved = base.join("backup.sqlite3");
        let db = open_database(live.clone()).await.unwrap();
        add_customer(&db, CustomerInput { code: "C-1".into(), name: "مشتری".into(), phone: "".into(), opening: "100".into() }).await.unwrap();
        create_backup(&db, saved.clone()).await.unwrap();
        let bytes = std::fs::read(&saved).unwrap();
        assert!(create_backup(&db, saved.clone()).await.is_err());
        assert_eq!(std::fs::read(&saved).unwrap(), bytes);
        assert!(create_backup(&db, live.clone()).await.is_err());
        assert!(create_backup(&db, base.join("wrong.sql")).await.is_err());
        add_customer(&db, CustomerInput { code: "C-2".into(), name: "دوم".into(), phone: "".into(), opening: "0".into() }).await.unwrap();
        let copy = SqlitePoolOptions::new().max_connections(1).connect_with(SqliteConnectOptions::new().filename(&saved).read_only(true).foreign_keys(true)).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers").fetch_one(&copy).await.unwrap();
        assert_eq!(count, 1); // Changes after the snapshot do not alter it.
        copy.close().await;
        db.close().await;
        std::fs::remove_dir_all(base).unwrap();
    }

    #[tokio::test]
    async fn editing_customer_keeps_transactions_and_recalculates_opening_balance() {
        let path = std::env::temp_dir().join(format!("customer-edit-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        add_customer(&db, CustomerInput { code: "C-1".into(), name: "مشتری".into(), phone: "".into(), opening: "100".into() }).await.unwrap();
        add_customer(&db, CustomerInput { code: "C-2".into(), name: "دوم".into(), phone: "".into(), opening: "0".into() }).await.unwrap();
        let customer = snapshot(&db).await.unwrap().customers.into_iter().find(|c| c.code == "C-1").unwrap();
        add_sale(&db, SaleInput { customer_id: customer.id.clone(), date: "2026-01-01".into(), material: "ریگ".into(), volume: "1".into(), unit_price: "500".into(), freight: "0".into(), payment_type: "credit".into(), details:SaleDetails::default() }).await.unwrap();
        assert!(update_customer(&db, customer.id.clone(), CustomerInput { code: "c-2".into(), name: "نام".into(), phone: "".into(), opening: "200".into() }).await.is_err());
        update_customer(&db, customer.id.clone(), CustomerInput { code: "C-1".into(), name: "ویرایش".into(), phone: "0700".into(), opening: "200".into() }).await.unwrap();
        let ledger = customer_ledger(&db, customer.id).await.unwrap();
        assert_eq!(ledger.customer_name, "ویرایش"); assert_eq!(ledger.balance, "700.00");
        assert!(update_customer(&db, "missing".into(), CustomerInput { code: "X".into(), name: "نام".into(), phone: "".into(), opening: "0".into() }).await.is_err());
        db.close().await; std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn edits_recalculate_balances_and_reject_stale_forms() {
        let path=std::env::temp_dir().join(format!("transaction-edit-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name,opening_cents) VALUES('c1','C1','اول',10000),('c2','C2','دوم',0)").execute(&db).await.unwrap();
        let sale=|| SaleInput {customer_id:"c1".into(),date:"2026-01-01".into(),material:"ریگ".into(),volume:"1.000".into(),unit_price:"200".into(),freight:"0".into(),payment_type:"credit".into(),details:SaleDetails::default()};
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c1','2026-01-01','ریگ',1000,20000,0,20000,'credit')").execute(&db).await.unwrap();
        let mut updated=sale(); updated.customer_id="c2".into(); updated.unit_price="300".into();
        update_sale(&db,"s".into(),updated,sale()).await.unwrap();
        assert!(update_sale(&db,"s".into(),sale(),sale()).await.is_err());
        assert_eq!(customer_ledger(&db,"c1".into()).await.unwrap().balance,"100.00"); assert_eq!(customer_ledger(&db,"c2".into()).await.unwrap().balance,"300.00");
        let receipt=|| ReceiptInput {customer_id:"c2".into(),date:"2026-01-02".into(),amount:"50".into(),source:"deposit".into(),details:ReceiptDetails::default()};
        sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c2','2026-01-02',5000,'deposit')").execute(&db).await.unwrap();
        let mut changed=receipt(); changed.source="debt".into(); update_receipt(&db,"r".into(),changed,receipt()).await.unwrap();
        assert!(update_receipt(&db,"r".into(),receipt(),receipt()).await.is_err()); assert_eq!(customer_ledger(&db,"c2".into()).await.unwrap().balance,"250.00");
        let mut expected=sale(); expected.customer_id="c2".into(); expected.unit_price="300".into();
        let mut bad=sale(); bad.customer_id="missing".into(); assert!(update_sale(&db,"s".into(),bad,expected).await.is_err());
        assert_eq!(customer_ledger(&db,"c2".into()).await.unwrap().balance,"250.00");
        db.close().await; std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn supplemental_fields_are_atomic_and_stale_forms_do_not_overwrite_them() {
        let path=std::env::temp_dir().join(format!("details-edit-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&db).await.unwrap();
        let sale=|| SaleInput {customer_id:"c".into(),date:"2025-01-01".into(),material:"ریگ".into(),volume:"1".into(),unit_price:"100".into(),freight:"0".into(),payment_type:"credit".into(),details:SaleDetails::default()};
        let mut input=sale(); input.details.bill_no=" BL-1 ".into(); input.details.notes="اول\nدوم".into(); add_sale(&db,input).await.unwrap();
        let id:String=sqlx::query_scalar("SELECT id FROM sales").fetch_one(&db).await.unwrap();
        let mut expected=sale(); expected.details.bill_no="BL-1".into(); expected.details.notes="اول\nدوم".into();
        let mut change=sale(); change.details.bill_no="BL-2".into(); change.details.notes="اول\nدوم".into();
        update_sale(&db,id.clone(),change,expected).await.unwrap();
        let mut stale=sale(); stale.details.bill_no="BL-1".into(); stale.details.notes="اول\nدوم".into();
        let mut attempted=sale(); attempted.unit_price="200".into();
        assert!(update_sale(&db,id.clone(),attempted,stale).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT total_cents FROM sales WHERE id=?").bind(&id).fetch_one(&db).await.unwrap(),10000);
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT bill_no FROM sale_details WHERE sale_id=?").bind(&id).fetch_one(&db).await.unwrap(),"BL-2");
        let mut too_long=sale(); too_long.details.bill_no="الف".repeat(81); assert!(add_sale(&db,too_long).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM sales").fetch_one(&db).await.unwrap(),1);
        let receipt=|| ReceiptInput{customer_id:"c".into(),date:"2025-01-01".into(),amount:"20".into(),source:"debt".into(),details:ReceiptDetails::default()};
        let mut r=receipt(); r.details.received_by="احمد".into(); add_receipt(&db,r).await.unwrap();
        let rid:String=sqlx::query_scalar("SELECT id FROM receipts").fetch_one(&db).await.unwrap();
        let mut r_expected=receipt(); r_expected.details.received_by="احمد".into();
        let mut r_changed=receipt(); r_changed.details.received_by="محمود".into(); update_receipt(&db,rid.clone(),r_changed,r_expected).await.unwrap();
        let mut stale=receipt(); stale.details.received_by="احمد".into(); assert!(update_receipt(&db,rid.clone(),receipt(),stale).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,String>("SELECT received_by FROM receipt_details WHERE receipt_id=?").bind(&rid).fetch_one(&db).await.unwrap(),"محمود");
        db.close().await; std::fs::remove_file(path).unwrap();
    }

}
