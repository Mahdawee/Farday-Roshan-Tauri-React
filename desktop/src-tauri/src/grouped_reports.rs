//! Experimental grouped reports, using stored text labels rather than legacy lookup IDs.
use serde::{Deserialize, Serialize};
use std::{io::Write, path::Path};
use sqlx::{Row, SqlitePool};
use crate::service::{money, valid_date};

#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
pub(crate) struct MaterialGroup { material:String, count:i64, volume:String, total:String, cash:String, credit:String }
#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
pub(crate) struct ExpenseGroup { label:String, count:i64, afn:String, usd:String }
#[derive(Serialize, Deserialize, PartialEq, Eq, Debug)]
pub(crate) struct GroupedReport { materials:Vec<MaterialGroup>, expense_types:Vec<ExpenseGroup>, payers:Vec<ExpenseGroup> }
fn error(err:sqlx::Error)->String { eprintln!("Grouped report error: {err}"); "محاسبهٔ راپور تفکیکی ناموفق بود؛ بازه و مقدار معلومات را بررسی کنید.".into() }

// All three queries execute inside the same SQLite read transaction.
pub(crate) async fn grouped(db:&SqlitePool,from:String,to:String)->Result<GroupedReport,String> {
    valid_date(&from)?; valid_date(&to)?;
    if from>to {return Err("تاریخ آغاز نباید پس از تاریخ پایان باشد.".into());}
    let mut tx=db.begin().await.map_err(error)?;
    let sales=sqlx::query("SELECT material, COUNT(*) AS count, SUM(volume_milli) AS volume, SUM(total_cents) AS total, SUM(CASE WHEN payment_type='cash' THEN total_cents ELSE 0 END) AS cash, SUM(CASE WHEN payment_type='credit' THEN total_cents ELSE 0 END) AS credit FROM sales WHERE sale_date BETWEEN ?1 AND ?2 GROUP BY material COLLATE BINARY ORDER BY total DESC, material COLLATE BINARY ASC")
        .bind(&from).bind(&to).fetch_all(&mut *tx).await.map_err(error)?;
    let materials=sales.into_iter().map(|r| {
        let volume:i64=r.try_get("volume").map_err(error)?;
        Ok(MaterialGroup {material:r.try_get("material").map_err(error)?,count:r.try_get("count").map_err(error)?,volume:format!("{}.{:03}",volume/1000,volume%1000),total:money(r.try_get("total").map_err(error)?),cash:money(r.try_get("cash").map_err(error)?),credit:money(r.try_get("credit").map_err(error)?)})
    }).collect::<Result<Vec<_>,String>>()?;
    let mut groups=Vec::new();
    for column in ["expense_type","payer"] {
        // Column names are fixed constants, never user supplied.
        let sql=format!("SELECT {column} AS label, COUNT(*) AS count, SUM(amount_afn_cents) AS afn, SUM(amount_usd_cents) AS usd FROM expenses WHERE expense_date BETWEEN ?1 AND ?2 GROUP BY {column} COLLATE BINARY ORDER BY afn DESC, {column} COLLATE BINARY ASC");
        let rows=sqlx::query(&sql).bind(&from).bind(&to).fetch_all(&mut *tx).await.map_err(error)?;
        groups.push(rows.into_iter().map(|r|Ok(ExpenseGroup {label:r.try_get("label").map_err(error)?,count:r.try_get("count").map_err(error)?,afn:money(r.try_get("afn").map_err(error)?),usd:money(r.try_get("usd").map_err(error)?)})).collect::<Result<Vec<_>,String>>()?);
    }
    let payers=groups.pop().unwrap(); let expense_types=groups.pop().unwrap();
    tx.commit().await.map_err(error)?; Ok(GroupedReport {materials,expense_types,payers})
}

/// CSV fields are quoted and quotes escaped. User-provided labels are prefixed
/// with an apostrophe even when they contain whitespace or control characters,
/// reducing the chance of spreadsheet formula interpretation on import. This
/// changes the raw CSV text and is not a universal spreadsheet guarantee.
fn cell(text:&str)->String { format!("\"{}\"",text.replace('"',"\"\"")) }
fn user_cell(text:&str)->String { if text.is_empty() {cell("")} else {cell(&format!("'{text}"))} }
fn line(cells:&[String])->String { format!("{}\r\n",cells.join(",")) }
fn grouped_csv(report:&GroupedReport,from:&str,to:&str)->String {
    let mut out=String::from("\u{feff}");
    out.push_str(&line(&[cell("بخش"),cell("عنوان"),cell("تعداد"),cell("متراژ متر مکعب"),cell("مجموع فروش افغانی"),cell("فروش نقده افغانی"),cell("فروش باقی افغانی"),cell("مصارف افغانی"),cell("مصارف دالری")]));
    for (title,value) in [
        ("راپور تفکیکی آزمایشی","موجودی دخل یا سود نیست"),
        ("از تاریخ میلادی شامل",from), ("تا تاریخ میلادی شامل",to),
        ("توضیح","گروه‌بندی بر اساس متن دقیق است؛ مصارف نقده و باقی شامل‌اند و ارزها تبدیل نمی‌شوند."),
        ("توضیح","عنوان‌های غیرخالی کاربر با نویسهٔ تک‌نقل‌قول آغاز می‌شوند تا خطر فرمول کاهش یابد؛ این محافظت در همهٔ برنامه‌ها تضمین نیست."),
    ] { out.push_str(&line(&[cell(title),cell(value),cell(""),cell(""),cell(""),cell(""),cell(""),cell(""),cell("")])); }
    for row in &report.materials {
        out.push_str(&line(&[cell("فروش بر اساس مواد"),user_cell(&row.material),cell(&row.count.to_string()),cell(&row.volume),cell(&row.total),cell(&row.cash),cell(&row.credit),cell(""),cell("")]));
    }
    for (title,groups) in [("مصارف بر اساس نوع",&report.expense_types),("مصارف بر اساس پرداخت‌کننده",&report.payers)] {
        for row in groups {
            out.push_str(&line(&[cell(title),user_cell(&row.label),cell(&row.count.to_string()),cell(""),cell(""),cell(""),cell(""),cell(&row.afn),cell(&row.usd)]));
        }
    }
    out
}

/// Compare all displayed grouped rows against one fresh read snapshot before
/// reserving a new destination. The file never overwrites an existing file.
pub(crate) async fn export_csv(db:&SqlitePool,from:String,to:String,expected:GroupedReport,path:&Path)->Result<(),String> {
    if !path.is_absolute() || path.extension().and_then(|s|s.to_str()).map(|s|s.to_ascii_lowercase()).as_deref()!=Some("csv") {
        return Err("مسیر مطلق با پسوند csv انتخاب کنید.".into());
    }
    let actual=grouped(db,from.clone(),to.clone()).await?;
    if actual!=expected {return Err("راپور تفکیکی تغییر کرده است؛ ابتدا دوباره محاسبه کنید.".into());}
    let content=grouped_csv(&actual,&from,&to);
    let mut file=std::fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|_| "فایل ساخته نشد؛ مسیر را بررسی کنید و نام فایل جدید انتخاب کنید.".to_string())?;
    if let Err(err)=file.write_all(content.as_bytes()).and_then(|_|file.sync_all()) {
        eprintln!("Grouped CSV error: {err}");
        return Err("نوشتن فایل راپور ناموفق بود؛ فایل ناقص احتمالی را بررسی و حذف کنید.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
    #[test]
    fn csv_quotes_user_labels_and_prefixes_every_nonempty_value() {
        assert_eq!(user_cell(""), "\"\"");
        for s in ["=1+1", "+cmd", "-1", "@x", "\t=2", " normal"] {
            assert_eq!(user_cell(s),format!("\"'{s}\""));
        }
        assert_eq!(user_cell("=x,\"z\"\nnext"),"\"'=x,\"\"z\"\"\nnext\"");
    }
    #[tokio::test]
    async fn csv_checks_all_groups_and_never_overwrites() {
        let dir=std::env::temp_dir().join(format!("grouped-csv-{}",Uuid::new_v4())); std::fs::create_dir(&dir).unwrap();
        let db=open_database(dir.join("db.sqlite3")).await.unwrap(); let target=dir.join("report.csv");
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-03-21',?,1000,100,0,100,'cash')").bind("=x,\"z\"\nnext").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,expense_type,payer,amount_afn_cents,amount_usd_cents,payment_method) VALUES('e','2025-03-21','x','',?,120,340,'credit')").bind("+payer").execute(&db).await.unwrap();
        let from="2025-03-21".to_string(); let to="2025-03-22".to_string();
        let expected=grouped(&db,from.clone(),to.clone()).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),expected,Path::new("relative.csv")).await.is_err());
        let expected=grouped(&db,from.clone(),to.clone()).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),expected,&target.with_extension("txt")).await.is_err());
        let stale=grouped(&db,from.clone(),to.clone()).await.unwrap();
        // Same totals but a changed label must also invalidate the result.
        sqlx::query("UPDATE expenses SET payer='@changed' WHERE id='e'").execute(&db).await.unwrap();
        assert!(export_csv(&db,from.clone(),to.clone(),stale,&target).await.is_err()); assert!(!target.exists());
        let expected=grouped(&db,from.clone(),to.clone()).await.unwrap();
        export_csv(&db,from.clone(),to.clone(),expected,&target).await.unwrap();
        let bytes=std::fs::read(&target).unwrap(); assert!(bytes.starts_with(&[0xef,0xbb,0xbf]));
        let text=String::from_utf8(bytes.clone()).unwrap();
        assert!(text.contains("\"'=x,\"\"z\"\"\nnext\"")); assert!(text.contains("\"'@changed\""));
        assert!(text.contains("\"1.20\",\"3.40\"")); assert!(text.contains("\"مصارف بر اساس نوع\",\"\""));
        let expected=grouped(&db,from.clone(),to.clone()).await.unwrap();
        assert!(export_csv(&db,from,to,expected,&target).await.is_err()); assert_eq!(std::fs::read(&target).unwrap(),bytes);
        db.close().await; std::fs::remove_dir_all(dir).unwrap();
    }
    #[tokio::test]
    async fn grouped_report_uses_full_history_and_separate_currencies() {
        let path=std::env::temp_dir().join(format!("grouped-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&db).await.unwrap();
        for i in 0..105 {sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES(?,'c','2025-03-21','ریگ',1000,100,0,100,'credit')").bind(format!("s{i}")).execute(&db).await.unwrap();}
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('cash','c','2025-03-22','ریگ',1250,100,0,125,'cash'),('out','c','2025-03-23','خاک',1000,100,0,100,'cash')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO expenses(id,expense_date,description,expense_type,payer,amount_afn_cents,amount_usd_cents,payment_method) VALUES('a','2025-03-21','x','تیل','علی',120,340,'credit'),('b','2025-03-22','y','تیل','',80,25,'cash'),('c2','2025-03-23','z','دیگر','علی',999,0,'cash')").execute(&db).await.unwrap();
        let report=grouped(&db,"2025-03-21".into(),"2025-03-22".into()).await.unwrap();
        assert_eq!(report.materials.len(),1); let m=&report.materials[0]; assert_eq!((m.material.as_str(),m.count,m.volume.as_str(),m.total.as_str(),m.cash.as_str(),m.credit.as_str()),("ریگ",106,"106.250","106.25","1.25","105.00"));
        let e=&report.expense_types[0]; assert_eq!((e.label.as_str(),e.count,e.afn.as_str(),e.usd.as_str()),("تیل",2,"2.00","3.65"));
        assert_eq!(report.payers.len(),2); assert_eq!(report.payers[1].label,""); assert_eq!(report.payers[1].usd,"0.25");
        assert!(grouped(&db,"2025-02-29".into(),"2025-03-22".into()).await.is_err()); assert!(grouped(&db,"2025-03-23".into(),"2025-03-22".into()).await.is_err());
        let empty=grouped(&db,"2024-01-01".into(),"2024-01-01".into()).await.unwrap(); assert!(empty.materials.is_empty() && empty.expense_types.is_empty() && empty.payers.is_empty());
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
