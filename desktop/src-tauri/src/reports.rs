//! Experimental interval totals. These are not a cash balance or a profit calculation.
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;
use sqlx::{Row, SqlitePool};
use crate::service::{money, valid_date};

// A single statement provides a consistent SQLite read snapshot across all tables.
const SUMMARY_SQL: &str = "SELECT * FROM
 (SELECT COUNT(*) AS sales_count,
    COALESCE(SUM(CASE WHEN payment_type='cash' THEN total_cents ELSE 0 END),0) AS sales_cash,
    COALESCE(SUM(CASE WHEN payment_type='credit' THEN total_cents ELSE 0 END),0) AS sales_credit,
    COALESCE(SUM(volume_milli),0) AS volume
  FROM sales WHERE sale_date BETWEEN ?1 AND ?2)
 CROSS JOIN
 (SELECT COUNT(*) AS receipts_count,
    COALESCE(SUM(CASE WHEN source <> 'deposit' THEN amount_cents ELSE 0 END),0) AS receipts_effective,
    COALESCE(SUM(CASE WHEN source = 'deposit' THEN amount_cents ELSE 0 END),0) AS receipts_deposit
  FROM receipts WHERE receipt_date BETWEEN ?1 AND ?2)
 CROSS JOIN
 (SELECT COUNT(*) AS expenses_count, COALESCE(SUM(amount_afn_cents),0) AS expenses_afn, COALESCE(SUM(amount_usd_cents),0) AS expenses_usd
  FROM expenses WHERE expense_date BETWEEN ?1 AND ?2)
 CROSS JOIN
 (SELECT COUNT(*) AS salaries_count, COALESCE(SUM(total_cents),0) AS salaries_afn
  FROM salaries WHERE pay_date BETWEEN ?1 AND ?2)";

#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
pub(crate) struct RangeSummary {
    sales_count:i64, sales_cash:String, sales_credit:String, volume:String,
    receipts_count:i64, receipts_effective:String, receipts_deposit:String,
    expenses_count:i64, expenses_afn:String, expenses_usd:String,
    salaries_count:i64, salaries_afn:String,
}
fn error(err:sqlx::Error)->String { eprintln!("Report error: {err}"); "محاسبهٔ راپور ناموفق بود؛ بازه و مقدار معلومات را بررسی کنید.".into() }
pub(crate) async fn range_summary(db:&SqlitePool, from:String, to:String)->Result<RangeSummary,String> {
    valid_date(&from)?; valid_date(&to)?;
    if from>to { return Err("تاریخ آغاز نباید پس از تاریخ پایان باشد.".into()); }
    let r=sqlx::query(SUMMARY_SQL).bind(from).bind(to).fetch_one(db).await.map_err(error)?;
    let volume:i64=r.try_get("volume").map_err(error)?;
    Ok(RangeSummary {
        sales_count:r.try_get("sales_count").map_err(error)?, sales_cash:money(r.try_get("sales_cash").map_err(error)?), sales_credit:money(r.try_get("sales_credit").map_err(error)?), volume:format!("{}.{:03}",volume/1000,volume%1000),
        receipts_count:r.try_get("receipts_count").map_err(error)?, receipts_effective:money(r.try_get("receipts_effective").map_err(error)?), receipts_deposit:money(r.try_get("receipts_deposit").map_err(error)?),
        expenses_count:r.try_get("expenses_count").map_err(error)?, expenses_afn:money(r.try_get("expenses_afn").map_err(error)?), expenses_usd:money(r.try_get("expenses_usd").map_err(error)?),
        salaries_count:r.try_get("salaries_count").map_err(error)?, salaries_afn:money(r.try_get("salaries_afn").map_err(error)?),
    })
}

/// Export the exact result the user viewed, or reject it if underlying totals changed.
pub(crate) async fn export_csv(db:&SqlitePool, from:String, to:String, expected:RangeSummary, path:&Path)->Result<(),String> {
    if !path.is_absolute() || path.extension().and_then(|s|s.to_str()).map(|s|s.to_ascii_lowercase()).as_deref()!=Some("csv") {
        return Err("مسیر مطلق با پسوند csv انتخاب کنید.".into());
    }
    let actual=range_summary(db,from.clone(),to.clone()).await?;
    if actual!=expected { return Err("جمع‌های راپور تغییر کرده‌اند؛ ابتدا دوباره محاسبه کنید.".into()); }
    // Every text cell below is a fixed label or a validated ISO date; values are formatted integers.
    let content=format!("\u{feff}شاخص,مقدار,واحد\r\nاز تاریخ,{from},میلادی\r\nتا تاریخ,{to},میلادی\r\nتعداد فروش,{},رکورد\r\nفروش نقده,{},افغانی\r\nفروش باقی,{},افغانی\r\nمتراژ فروش,{},متر مکعب\r\nتعداد رسید,{},رکورد\r\nرسیدهای مؤثر بر بدهی,{},افغانی\r\nرسید امانت,{},افغانی\r\nتعداد مصارف,{},رکورد\r\nمصارف افغانی,{},افغانی\r\nمصارف دالری,{},دالر\r\nتعداد معاشات,{},رکورد\r\nمعاشات,{},افغانی\r\n", actual.sales_count, actual.sales_cash, actual.sales_credit, actual.volume, actual.receipts_count, actual.receipts_effective, actual.receipts_deposit, actual.expenses_count, actual.expenses_afn, actual.expenses_usd, actual.salaries_count, actual.salaries_afn);
    // create_new prevents replacing existing reports or following an existing symlink.
    let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(path)
        .map_err(|_| "فایل ساخته نشد؛ مسیر را بررسی کنید و نام فایل جدید انتخاب کنید.".to_string())?;
    if let Err(err)=file.write_all(content.as_bytes()).and_then(|_|file.sync_all()) {
        eprintln!("Report export error: {err}");
        return Err("نوشتن فایل راپور ناموفق بود؛ فایل ناقص احتمالی را بررسی و حذف کنید.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
    #[tokio::test]
    async fn export_never_overwrites_or_exports_a_stale_summary() {
        let base=std::env::temp_dir(); let path=base.join(format!("export-test-{}.sqlite3",Uuid::new_v4())); let target=base.join(format!("report-{}.csv",Uuid::new_v4()));
        let db=open_database(path.clone()).await.unwrap(); let from="2025-03-21".to_string(); let to="2025-03-22".to_string();
        let expected=range_summary(&db,from.clone(),to.clone()).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),expected,Path::new("relative.csv")).await.is_err());
        let expected=range_summary(&db,from.clone(),to.clone()).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),expected,&target.with_extension("txt")).await.is_err());
        let expected=range_summary(&db,from.clone(),to.clone()).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES('x','2025-03-21','x',125,525,'credit')").execute(&db).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),expected,&target).await.is_err()); assert!(!target.exists());
        let expected=range_summary(&db,from.clone(),to.clone()).await.unwrap();
        export_csv(&db,from.clone(),to.clone(),expected,&target).await.unwrap();
        let bytes=std::fs::read(&target).unwrap(); assert!(bytes.starts_with(&[0xef,0xbb,0xbf]));
        let text=String::from_utf8(bytes.clone()).unwrap(); assert!(text.contains("مصارف افغانی,1.25,افغانی")); assert!(text.contains("مصارف دالری,5.25,دالر"));
        let expected=range_summary(&db,from.clone(),to.clone()).await.unwrap(); assert!(export_csv(&db,from,to,expected,&target).await.is_err()); assert_eq!(std::fs::read(&target).unwrap(),bytes);
        db.close().await; std::fs::remove_file(path).unwrap(); std::fs::remove_file(target).unwrap();
    }
    #[tokio::test]
    async fn range_uses_all_sources_and_inclusive_dates() {
        let path=std::env::temp_dir().join(format!("report-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')").execute(&db).await.unwrap();
        for i in 0..105 { sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES(?,'c','2025-03-21','ریگ',1000,100,0,100,'credit')").bind(format!("s{i}")).execute(&db).await.unwrap(); }
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('cash','c','2025-03-22','ریگ',1250,100,0,125,'cash'),('outside','c','2025-03-23','ریگ',1000,100,0,100,'credit')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r1','c','2025-03-21',200,'debt'),('r2','c','2025-03-22',300,'deposit')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,amount_afn_cents,amount_usd_cents,payment_method) VALUES('x','2025-03-21','x',120,340,'credit')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payment_type) VALUES('p','e','shamsi',1404,1,'2025-03-22',100,0,300,0,-200,'transfer')").execute(&db).await.unwrap();
        let r=range_summary(&db,"2025-03-21".into(),"2025-03-22".into()).await.unwrap();
        assert_eq!(r.sales_count,106); assert_eq!(r.sales_credit,"105.00"); assert_eq!(r.sales_cash,"1.25"); assert_eq!(r.volume,"106.250");
        assert_eq!(r.receipts_effective,"2.00"); assert_eq!(r.receipts_deposit,"3.00"); assert_eq!(r.expenses_afn,"1.20"); assert_eq!(r.expenses_usd,"3.40"); assert_eq!(r.salaries_afn,"-2.00");
        assert!(range_summary(&db,"2025-03-22".into(),"2025-03-21".into()).await.is_err()); assert!(range_summary(&db,"2025-02-29".into(),"2025-03-22".into()).await.is_err());
        let empty=range_summary(&db,"2024-01-01".into(),"2024-01-01".into()).await.unwrap(); assert_eq!(empty.sales_count,0); assert_eq!(empty.expenses_usd,"0.00");
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
