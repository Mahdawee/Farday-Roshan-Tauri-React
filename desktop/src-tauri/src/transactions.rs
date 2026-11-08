//! Paged transaction history; the dashboard's 100 mixed entries are not a ledger.
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use crate::service::{money, valid_date};

const PAGE_SIZE: i64 = 25;
#[derive(Deserialize)]
pub(crate) struct TransactionQuery { kind: String, page: i64, search: String, from: Option<String>, to: Option<String>, customer_id: Option<String>, subtype: Option<String> }
#[derive(Serialize)]
pub(crate) struct TransactionRow { id: String, kind: String, date: String, customer_name: String, customer_code: String, detail: String, amount: String }
#[derive(Serialize)]
pub(crate) struct TransactionPage { rows: Vec<TransactionRow>, total: i64, page: i64, page_size: i64 }
fn error(err: sqlx::Error) -> String { eprintln!("Transaction list error: {err}"); "خواندن فهرست عملیات ناموفق بود.".into() }

pub(crate) async fn list(db: &SqlitePool, q: TransactionQuery) -> Result<TransactionPage, String> {
    if !(0..=1_000_000).contains(&q.page) || q.search.len()>320 { return Err("صفحه یا متن جستجو معتبر نیست.".into()); }
    if let Some(ref from)=q.from { valid_date(from)?; }
    if let Some(ref to)=q.to { valid_date(to)?; }
    if matches!((&q.from, &q.to), (Some(from), Some(to)) if from > to) { return Err("تاریخ آغاز نباید پس از تاریخ پایان باشد.".into()); }
    if let Some(ref customer_id)=q.customer_id { if customer_id.trim().is_empty() || customer_id.len()>80 { return Err("مشتری انتخاب‌شده معتبر نیست.".into()); } }
    if let Some(ref subtype)=q.subtype {
        let valid = match q.kind.as_str() { "sale" => matches!(subtype.as_str(), "cash" | "credit"), "receipt" => matches!(subtype.as_str(), "debt" | "deposit" | "statement" | "advance"), _ => false };
        if !valid { return Err("فیلتر نوع عملیات معتبر نیست.".into()); }
    }
    // Only these fixed fragments can become SQL; all user values remain parameters.
    let select = match q.kind.as_str() {
        "sale" => "SELECT s.id, 'sale' AS kind, s.customer_id, s.payment_type AS subtype, s.sale_date AS date, c.name AS customer_name, c.code AS customer_code, s.material || ' · ' || CASE s.payment_type WHEN 'credit' THEN 'باقی' ELSE 'نقده' END AS detail, s.total_cents AS amount, s.created_at AS created_at FROM sales s JOIN customers c ON c.id=s.customer_id",
        "receipt" => "SELECT r.id, 'receipt' AS kind, r.customer_id, r.source AS subtype, r.receipt_date AS date, c.name AS customer_name, c.code AS customer_code, CASE r.source WHEN 'debt' THEN 'باقی داری' WHEN 'deposit' THEN 'امانت' WHEN 'statement' THEN 'بیانیه' ELSE 'پیش پرداخت' END AS detail, r.amount_cents AS amount, r.created_at AS created_at FROM receipts r JOIN customers c ON c.id=r.customer_id",
        _ => return Err("نوع عملیات معتبر نیست.".into()),
    };
    let where_clause = " WHERE (?1 IS NULL OR date >= ?1) AND (?2 IS NULL OR date <= ?2) AND (?4 IS NULL OR customer_id = ?4) AND (?5 IS NULL OR subtype = ?5) AND (instr(lower(customer_name),lower(?3))>0 OR instr(lower(customer_code),lower(?3))>0 OR instr(lower(detail),lower(?3))>0 OR instr(date,?3)>0)";
    let count_query=format!("WITH records AS ({select}) SELECT COUNT(*) FROM records{where_clause}");
    let rows_query=format!("WITH records AS ({select}) SELECT id,kind,date,customer_name,customer_code,detail,amount FROM records{where_clause} ORDER BY date DESC,created_at DESC,id DESC LIMIT ?6 OFFSET ?7");
    let mut tx=db.begin().await.map_err(error)?;
    let total:i64=sqlx::query_scalar(&count_query).bind(&q.from).bind(&q.to).bind(q.search.trim()).bind(&q.customer_id).bind(&q.subtype).fetch_one(&mut *tx).await.map_err(error)?;
    let rows=sqlx::query(&rows_query).bind(&q.from).bind(&q.to).bind(q.search.trim()).bind(&q.customer_id).bind(&q.subtype).bind(PAGE_SIZE).bind(q.page*PAGE_SIZE).fetch_all(&mut *tx).await.map_err(error)?;
    let rows=rows.into_iter().map(|r| Ok(TransactionRow { id:r.try_get("id").map_err(error)?, kind:r.try_get("kind").map_err(error)?, date:r.try_get("date").map_err(error)?, customer_name:r.try_get("customer_name").map_err(error)?, customer_code:r.try_get("customer_code").map_err(error)?, detail:r.try_get("detail").map_err(error)?, amount:money(r.try_get("amount").map_err(error)?) })).collect::<Result<Vec<_>,String>>()?;
    tx.commit().await.map_err(error)?; Ok(TransactionPage { rows, total, page:q.page, page_size:PAGE_SIZE })
}
#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
    fn query(kind:&str,page:i64) -> TransactionQuery { TransactionQuery {kind:kind.into(),page,search:String::new(),from:None,to:None,customer_id:None,subtype:None} }
    #[tokio::test]
    async fn paginates_each_kind_and_filters_every_record_not_only_the_dashboard() {
        let path=std::env::temp_dir().join(format!("transaction-pages-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C-1','مشتری')").execute(&db).await.unwrap();
        for i in 0..130 {
            sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES(?,'c',?, ?,1000,100,0,100,'credit')")
                .bind(format!("s{i:03}")).bind(if i<25 {"2024-01-01"} else {"2026-01-01"}).bind(if i==0 {"ویژه %"} else {"ریگ"}).execute(&db).await.unwrap();
        }
        sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2026-02-01',125,'deposit')").execute(&db).await.unwrap();
        let first=list(&db,query("sale",0)).await.unwrap(); assert_eq!(first.total,130); assert_eq!(first.rows.len(),25);
        let last=list(&db,query("sale",5)).await.unwrap(); assert_eq!(last.rows.len(),5); assert!(last.rows.iter().any(|r| r.id=="s000"));
        let mut filtered=query("sale",0); filtered.search="%".into(); let found=list(&db,filtered).await.unwrap(); assert_eq!(found.total,1); assert_eq!(found.rows[0].id,"s000");
        let mut filtered=query("sale",0); filtered.from=Some("2024-01-01".into()); filtered.to=Some("2024-01-01".into()); assert_eq!(list(&db,filtered).await.unwrap().total,25);
        let mut filtered=query("sale",0); filtered.customer_id=Some("c".into()); filtered.subtype=Some("credit".into()); assert_eq!(list(&db,filtered).await.unwrap().total,130);
        let mut filtered=query("receipt",0); filtered.subtype=Some("deposit".into()); assert_eq!(list(&db,filtered).await.unwrap().rows[0].amount,"1.25");
        let mut filtered=query("receipt",0); filtered.subtype=Some("credit".into()); assert!(list(&db,filtered).await.is_err());
        assert!(list(&db,query("sale",-1)).await.is_err()); assert!(list(&db,query("bad",0)).await.is_err());
        let mut invalid=query("sale",0); invalid.from=Some("2025-02-29".into()); assert!(list(&db,invalid).await.is_err());
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}

/// Read-only source details; amounts remain decimal strings at the UI boundary.
#[derive(Serialize)]
#[serde(tag="kind", rename_all="snake_case")]
pub(crate) enum TransactionDetail {
    Sale { id:String, date:String, customer_name:String, customer_code:String, material:String, volume:String, unit_price:String, freight:String, total:String, payment_type:String },
    Receipt { id:String, date:String, customer_name:String, customer_code:String, amount:String, source:String },
}
pub(crate) async fn detail(db: &SqlitePool, kind: String, id: String) -> Result<TransactionDetail, String> {
    if id.is_empty() || id.len()>80 { return Err("شناسهٔ عملیات معتبر نیست.".into()); }
    if kind == "sale" {
        let r=sqlx::query("SELECT s.id,s.sale_date,c.name AS customer_name,c.code AS customer_code,s.material,s.volume_milli,s.unit_price_cents,s.freight_cents,s.total_cents,s.payment_type FROM sales s JOIN customers c ON c.id=s.customer_id WHERE s.id=?").bind(id).fetch_optional(db).await.map_err(error)?.ok_or("فروش انتخاب‌شده وجود ندارد.")?;
        let volume:i64=r.try_get("volume_milli").map_err(error)?;
        Ok(TransactionDetail::Sale { id:r.try_get("id").map_err(error)?,date:r.try_get("sale_date").map_err(error)?,customer_name:r.try_get("customer_name").map_err(error)?,customer_code:r.try_get("customer_code").map_err(error)?,material:r.try_get("material").map_err(error)?,volume:format!("{}.{:03}",volume/1000,volume%1000),unit_price:money(r.try_get("unit_price_cents").map_err(error)?),freight:money(r.try_get("freight_cents").map_err(error)?),total:money(r.try_get("total_cents").map_err(error)?),payment_type:r.try_get("payment_type").map_err(error)? })
    } else if kind == "receipt" {
        let r=sqlx::query("SELECT r.id,r.receipt_date,c.name AS customer_name,c.code AS customer_code,r.amount_cents,r.source FROM receipts r JOIN customers c ON c.id=r.customer_id WHERE r.id=?").bind(id).fetch_optional(db).await.map_err(error)?.ok_or("رسید انتخاب‌شده وجود ندارد.")?;
        Ok(TransactionDetail::Receipt {id:r.try_get("id").map_err(error)?,date:r.try_get("receipt_date").map_err(error)?,customer_name:r.try_get("customer_name").map_err(error)?,customer_code:r.try_get("customer_code").map_err(error)?,amount:money(r.try_get("amount_cents").map_err(error)?),source:r.try_get("source").map_err(error)?})
    } else { Err("نوع عملیات معتبر نیست.".into()) }
}
#[cfg(test)]
mod detail_tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
    #[tokio::test]
    async fn details_are_exact_and_reject_wrong_kind_and_missing_record() {
        let path=std::env::temp_dir().join(format!("transaction-details-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C1','مشتری')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO sales(id,customer_id,sale_date,material,volume_milli,unit_price_cents,freight_cents,total_cents,payment_type) VALUES('s','c','2026-01-01','ریگ',1250,20000,3000,28750,'credit')").execute(&db).await.unwrap();
        sqlx::query("INSERT INTO receipts(id,customer_id,receipt_date,amount_cents,source) VALUES('r','c','2026-01-02',125,'deposit')").execute(&db).await.unwrap();
        match detail(&db,"sale".into(),"s".into()).await.unwrap() { TransactionDetail::Sale {volume,unit_price,freight,total,..} => assert_eq!((volume.as_str(),unit_price.as_str(),freight.as_str(),total.as_str()),("1.250","200.00","30.00","287.50")), _=>panic!("wrong kind") }
        match detail(&db,"receipt".into(),"r".into()).await.unwrap() { TransactionDetail::Receipt {source,amount,..} => assert_eq!((source.as_str(),amount.as_str()),("deposit","1.25")), _=>panic!("wrong kind") }
        assert!(detail(&db,"receipt".into(),"s".into()).await.is_err()); assert!(detail(&db,"invalid".into(),"s".into()).await.is_err());
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
