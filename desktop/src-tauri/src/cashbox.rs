//! A manual cashbook. No other business transaction is automatically posted here.
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

const PAGE_SIZE:i64=25;
#[derive(Deserialize)]
pub(crate) struct CashboxInput { date:String, direction:String, description:String, amount_afn:String, amount_usd:String }
#[derive(Deserialize)]
pub(crate) struct CashboxQuery { from:String, to:String, page:i64 }
#[derive(Serialize)]
pub(crate) struct CashboxEntry { id:String, date:String, direction:String, description:String, amount_afn:String, amount_usd:String }
#[derive(Serialize)]
pub(crate) struct CashboxPage { rows:Vec<CashboxEntry>, page:i64, page_size:i64, total:i64, opening_afn:String, opening_usd:String, in_afn:String, in_usd:String, out_afn:String, out_usd:String, closing_afn:String, closing_usd:String }
fn error(err:sqlx::Error)->String { eprintln!("Cashbook database error: {err}"); "عملیات دفتر دستی دخل ناموفق بود.".into() }

pub(crate) async fn add(db:&SqlitePool, input:CashboxInput)->Result<(),String> {
    valid_date(&input.date)?;
    if !matches!(input.direction.as_str(),"in"|"out") {return Err("نوع حرکت دخل معتبر نیست.".into());}
    let description=input.description.trim(); if description.is_empty() || description.len()>1000 {return Err("شرح معتبر برای حرکت دخل وارد کنید.".into());}
    let afn=scaled(&input.amount_afn,2)?; let usd=scaled(&input.amount_usd,2)?;
    if afn==0 && usd==0 {return Err("حداقل یکی از مبلغ‌ها باید بیشتر از صفر باشد.".into());}
    sqlx::query("INSERT INTO cashbox_entries(id,entry_date,direction,description,amount_afn_cents,amount_usd_cents) VALUES(?,?,?,?,?,?)")
        .bind(Uuid::new_v4().to_string()).bind(input.date).bind(input.direction).bind(description).bind(afn).bind(usd).execute(db).await.map_err(error)?;
    Ok(())
}

// One read transaction keeps summary and page consistent; separate currencies never mix.
const SUMMARY_SQL:&str = "SELECT
 COUNT(CASE WHEN entry_date>=?1 THEN 1 END) AS total,
 COALESCE(SUM(CASE WHEN entry_date<?1 THEN CASE direction WHEN 'in' THEN amount_afn_cents ELSE -amount_afn_cents END ELSE 0 END),0) AS opening_afn,
 COALESCE(SUM(CASE WHEN entry_date<?1 THEN CASE direction WHEN 'in' THEN amount_usd_cents ELSE -amount_usd_cents END ELSE 0 END),0) AS opening_usd,
 COALESCE(SUM(CASE WHEN entry_date>=?1 AND direction='in' THEN amount_afn_cents ELSE 0 END),0) AS in_afn,
 COALESCE(SUM(CASE WHEN entry_date>=?1 AND direction='in' THEN amount_usd_cents ELSE 0 END),0) AS in_usd,
 COALESCE(SUM(CASE WHEN entry_date>=?1 AND direction='out' THEN amount_afn_cents ELSE 0 END),0) AS out_afn,
 COALESCE(SUM(CASE WHEN entry_date>=?1 AND direction='out' THEN amount_usd_cents ELSE 0 END),0) AS out_usd
 FROM cashbox_entries WHERE entry_date<=?2";
const ROWS_SQL:&str="SELECT id,entry_date,direction,description,amount_afn_cents,amount_usd_cents FROM cashbox_entries WHERE entry_date BETWEEN ?1 AND ?2 ORDER BY entry_date DESC,created_at DESC,id DESC LIMIT ?3 OFFSET ?4";
fn closing(opening:i64, incoming:i64, outgoing:i64)->Result<String,String> {
    let n:i64=(opening as i128+incoming as i128-outgoing as i128).try_into().map_err(|_| "ماندهٔ دفتر دخل بیش از حد قابل محاسبه است.")?; Ok(money(n))
}
pub(crate) async fn page(db:&SqlitePool, q:CashboxQuery)->Result<CashboxPage,String> {
    valid_date(&q.from)?; valid_date(&q.to)?;
    if q.from>q.to {return Err("تاریخ آغاز نباید پس از تاریخ پایان باشد.".into());}
    if !(0..=1_000_000).contains(&q.page) {return Err("صفحه معتبر نیست.".into());}
    let mut tx=db.begin().await.map_err(error)?;
    let sum=sqlx::query(SUMMARY_SQL).bind(&q.from).bind(&q.to).fetch_one(&mut *tx).await.map_err(error)?;
    let oa:i64=sum.try_get("opening_afn").map_err(error)?; let ou:i64=sum.try_get("opening_usd").map_err(error)?;
    let ia:i64=sum.try_get("in_afn").map_err(error)?; let iu:i64=sum.try_get("in_usd").map_err(error)?;
    let xa:i64=sum.try_get("out_afn").map_err(error)?; let xu:i64=sum.try_get("out_usd").map_err(error)?;
    let rows=sqlx::query(ROWS_SQL).bind(&q.from).bind(&q.to).bind(PAGE_SIZE).bind(q.page*PAGE_SIZE).fetch_all(&mut *tx).await.map_err(error)?;
    let rows=rows.into_iter().map(|r|Ok(CashboxEntry{id:r.try_get("id").map_err(error)?,date:r.try_get("entry_date").map_err(error)?,direction:r.try_get("direction").map_err(error)?,description:r.try_get("description").map_err(error)?,amount_afn:money(r.try_get("amount_afn_cents").map_err(error)?),amount_usd:money(r.try_get("amount_usd_cents").map_err(error)?)})).collect::<Result<Vec<_>,String>>()?;
    let result=CashboxPage {rows,page:q.page,page_size:PAGE_SIZE,total:sum.try_get("total").map_err(error)?,opening_afn:money(oa),opening_usd:money(ou),in_afn:money(ia),in_usd:money(iu),out_afn:money(xa),out_usd:money(xu),closing_afn:closing(oa,ia,xa)?,closing_usd:closing(ou,iu,xu)?};
    tx.commit().await.map_err(error)?; Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database;
    #[tokio::test]
    async fn counts_full_history_separates_currencies_and_never_imports_other_transactions() {
        let path=std::env::temp_dir().join(format!("manual-cashbox-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        let input=|date:&str,direction:&str,afn:&str,usd:&str|CashboxInput{date:date.into(),direction:direction.into(),description:"آزمایشی".into(),amount_afn:afn.into(),amount_usd:usd.into()};
        add(&db,input("2025-01-01","in","100","5")).await.unwrap();
        add(&db,input("2025-01-02","out","20","8")).await.unwrap();
        for _ in 0..30 {add(&db,input("2025-01-03","in","1","0")).await.unwrap();}
        add(&db,input("2025-01-04","in","999","9")).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','مشتری')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2025-01-03','x',1000,10000,0,10000,'cash')").execute(&db).await.unwrap();
        let q=||CashboxQuery{from:"2025-01-02".into(),to:"2025-01-03".into(),page:0}; let p=page(&db,q()).await.unwrap();
        assert_eq!((p.total,p.rows.len(),p.opening_afn.as_str(),p.opening_usd.as_str()),(31,25,"100.00","5.00"));
        assert_eq!((p.in_afn.as_str(),p.out_afn.as_str(),p.closing_afn.as_str(),p.closing_usd.as_str()),("30.00","20.00","110.00","-3.00"));
        let mut next=q(); next.page=1; assert_eq!(page(&db,next).await.unwrap().rows.len(),6);
        let mut invalid=q(); invalid.from="2025-02-29".into(); assert!(page(&db,invalid).await.is_err());
        assert!(add(&db,input("2025-01-01","out","0","0")).await.is_err());
        assert!(add(&db,input("2025-01-01","bad","1","0")).await.is_err());
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
