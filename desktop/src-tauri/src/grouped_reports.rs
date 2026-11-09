//! Experimental grouped reports, using stored text labels rather than legacy lookup IDs.
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use crate::service::{money, valid_date};

#[derive(Serialize)]
pub(crate) struct MaterialGroup { material:String, count:i64, volume:String, total:String, cash:String, credit:String }
#[derive(Serialize)]
pub(crate) struct ExpenseGroup { label:String, count:i64, afn:String, usd:String }
#[derive(Serialize)]
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

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
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
