//! Lookup master data only. Financial uses, authorization and protected history do not yet exist.
use serde::{Deserialize,Serialize};
use sqlx::{Row,SqlitePool};
use uuid::Uuid;

#[derive(Clone,Copy,Debug,Deserialize)]
#[serde(rename_all="snake_case")]
pub(crate) enum Kind {Material,Expense,Payer,ReceiptSource}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct LookupInput {name:String,active:bool,sort_order:i64,unit:Option<String>,payer_kind:Option<String>,affects_balance:Option<bool>}
#[derive(Debug,Serialize)]
pub(crate) struct Lookup {id:String,#[serde(flatten)] input:LookupInput,revision:i64}
struct Queries {list:&'static str,insert:&'static str,update:&'static str,delete:&'static str}
impl Kind {
    // SQL identifiers are hard-coded and cannot be supplied by the frontend.
    fn queries(self)->Queries {match self {
        Kind::Material=>Queries{list:"SELECT id,name,active,sort_order,unit,NULL payer_kind,NULL affects_balance,revision FROM material_types ORDER BY sort_order,name,id",insert:"INSERT INTO material_types(id,name,active,sort_order,unit) VALUES(?,?,?,?,?)",update:"UPDATE material_types SET name=?,active=?,sort_order=?,unit=?,revision=revision+1 WHERE id=? AND revision=?",delete:"DELETE FROM material_types WHERE id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM sales WHERE material_id=?)"},
        Kind::Expense=>Queries{list:"SELECT id,name,active,sort_order,NULL unit,NULL payer_kind,NULL affects_balance,revision FROM expense_types ORDER BY sort_order,name,id",insert:"INSERT INTO expense_types(id,name,active,sort_order) VALUES(?,?,?,?)",update:"UPDATE expense_types SET name=?,active=?,sort_order=?,revision=revision+1 WHERE id=? AND revision=?",delete:"DELETE FROM expense_types WHERE id=? AND revision=?"},
        Kind::Payer=>Queries{list:"SELECT id,name,active,sort_order,NULL unit,payer_kind,NULL affects_balance,revision FROM payers ORDER BY sort_order,name,id",insert:"INSERT INTO payers(id,name,active,sort_order,payer_kind) VALUES(?,?,?,?,?)",update:"UPDATE payers SET name=?,active=?,sort_order=?,payer_kind=?,revision=revision+1 WHERE id=? AND revision=?",delete:"DELETE FROM payers WHERE id=? AND revision=?"},
        Kind::ReceiptSource=>Queries{list:"SELECT id,name,active,sort_order,NULL unit,NULL payer_kind,affects_balance,revision FROM receipt_sources ORDER BY sort_order,name,id",insert:"INSERT INTO receipt_sources(id,name,active,sort_order,affects_balance) VALUES(?,?,?,?,?)",update:"UPDATE receipt_sources SET name=?,active=?,sort_order=?,affects_balance=?,revision=revision+1 WHERE id=? AND revision=?",delete:"DELETE FROM receipt_sources WHERE id=? AND revision=?"},
    }}
}
fn error(e:sqlx::Error)->String {
    if e.as_database_error().is_some_and(|d|d.is_unique_violation()){return "این نام در همین فهرست تکراری است.".into();}
    eprintln!("Lookup data error: {e}");"عملیات فهرست ناموفق بود.".into()
}
fn validate(kind:Kind,i:&LookupInput)->Result<(),String>{
    if i.name.trim().is_empty()||i.name.chars().count()>80||!(-2147483648..=2147483647).contains(&i.sort_order){return Err("نام یا ترتیب فهرست معتبر نیست.".into());}
    let extras=match kind {
        Kind::Material=>i.unit.as_ref().is_some_and(|u|!u.trim().is_empty()&&u.chars().count()<=20)&&i.payer_kind.is_none()&&i.affects_balance.is_none(),
        Kind::Expense=>i.unit.is_none()&&i.payer_kind.is_none()&&i.affects_balance.is_none(),
        Kind::Payer=>i.unit.is_none()&&i.payer_kind.as_deref().is_some_and(|k|matches!(k,"cashbox"|"personal"|"bank"|"company"))&&i.affects_balance.is_none(),
        Kind::ReceiptSource=>i.unit.is_none()&&i.payer_kind.is_none()&&i.affects_balance.is_some(),
    };
    if !extras{return Err("جزئیات این نوع فهرست معتبر نیست.".into());}Ok(())
}
pub(crate) async fn list(db:&SqlitePool,kind:Kind)->Result<Vec<Lookup>,String>{
    sqlx::query(kind.queries().list).fetch_all(db).await.map_err(error)?.into_iter().map(|r|{
        let active:i64=r.try_get("active").map_err(error)?;let affects:Option<i64>=r.try_get("affects_balance").map_err(error)?;
        Ok(Lookup{id:r.try_get("id").map_err(error)?,revision:r.try_get("revision").map_err(error)?,input:LookupInput{name:r.try_get("name").map_err(error)?,active:active!=0,sort_order:r.try_get("sort_order").map_err(error)?,unit:r.try_get("unit").map_err(error)?,payer_kind:r.try_get("payer_kind").map_err(error)?,affects_balance:affects.map(|n|n!=0)}})
    }).collect()
}
pub(crate) async fn save(db:&SqlitePool,kind:Kind,id:Option<String>,revision:Option<i64>,i:LookupInput)->Result<(),String>{
    validate(kind,&i)?;let q=kind.queries();
    match (id,revision) {
        (None,None)=>{
            let mut query=sqlx::query(q.insert).bind(Uuid::new_v4().to_string()).bind(i.name.trim()).bind(i.active).bind(i.sort_order);
            query=match kind {Kind::Material=>query.bind(i.unit.as_deref().unwrap().trim()),Kind::Expense=>query,Kind::Payer=>query.bind(i.payer_kind.as_deref().unwrap()),Kind::ReceiptSource=>query.bind(i.affects_balance.unwrap())};
            query.execute(db).await.map_err(error)?;
        }
        (Some(id),Some(revision))=>{
            let mut query=sqlx::query(q.update).bind(i.name.trim()).bind(i.active).bind(i.sort_order);
            query=match kind {Kind::Material=>query.bind(i.unit.as_deref().unwrap().trim()),Kind::Expense=>query,Kind::Payer=>query.bind(i.payer_kind.as_deref().unwrap()),Kind::ReceiptSource=>query.bind(i.affects_balance.unwrap())};
            let n=query.bind(id).bind(revision).execute(db).await.map_err(error)?.rows_affected();
            if n!=1{return Err("ردیف تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}
        }
        _=>return Err("نسخهٔ قبلی ردیف معتبر نیست.".into()),
    }Ok(())
}
pub(crate) async fn delete(db:&SqlitePool,kind:Kind,id:String,revision:i64)->Result<(),String>{
    let mut query=sqlx::query(kind.queries().delete).bind(&id).bind(revision);
    if matches!(kind,Kind::Material){query=query.bind(&id);}
    let n=query.execute(db).await.map_err(error)?.rows_affected();
    if n!=1{if matches!(kind,Kind::Material){let used:i64=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM sales WHERE material_id=?)").bind(&id).fetch_one(db).await.map_err(error)?;if used!=0{return Err("این ماده در فروش استفاده شده و حذف نمی‌شود؛ آن را غیرفعال کنید.".into());}}return Err("ردیف تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;use crate::open_database;
    fn input()->LookupInput{LookupInput{name:"نمونه".into(),active:true,sort_order:10,unit:None,payer_kind:None,affects_balance:None}}
    #[tokio::test] async fn four_types_validate_persist_and_reject_stale(){
        let path=std::env::temp_dir().join(format!("farday-lookup-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        for kind in [Kind::Material,Kind::Expense,Kind::Payer,Kind::ReceiptSource] {
            let mut i=input();match kind {Kind::Material=>i.unit=Some("متر مکعب".into()),Kind::Payer=>i.payer_kind=Some("bank".into()),Kind::ReceiptSource=>i.affects_balance=Some(false),Kind::Expense=>{}}
            save(&db,kind,None,None,i.clone()).await.unwrap();assert!(save(&db,kind,None,None,i.clone()).await.unwrap_err().contains("تکراری"));
            let row=list(&db,kind).await.unwrap().remove(0);assert_eq!(row.input.name,"نمونه");i.active=false;i.sort_order=-10;save(&db,kind,Some(row.id.clone()),Some(row.revision),i).await.unwrap();assert!(delete(&db,kind,row.id,row.revision).await.is_err());
        }
        let mut invalid=input();invalid.unit=Some("".into());assert!(save(&db,Kind::Material,None,None,invalid).await.is_err());
        let mut invalid=input();invalid.payer_kind=Some("unknown".into());assert!(save(&db,Kind::Payer,None,None,invalid).await.is_err());
        let mut invalid=input();invalid.affects_balance=Some(true);assert!(save(&db,Kind::Expense,None,None,invalid).await.is_err());
        db.close().await;let db=open_database(path.clone()).await.unwrap();
        for kind in [Kind::Material,Kind::Expense,Kind::Payer,Kind::ReceiptSource] {let row=list(&db,kind).await.unwrap().remove(0);assert!(!row.input.active);assert_eq!(row.input.sort_order,-10);if matches!(kind,Kind::ReceiptSource){assert_eq!(row.input.affects_balance,Some(false));}delete(&db,kind,row.id,row.revision).await.unwrap();assert!(list(&db,kind).await.unwrap().is_empty());}
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[test] fn kind_is_closed(){assert!(serde_json_test_kind().is_err());}
    fn serde_json_test_kind()->Result<Kind,serde::de::value::Error>{Kind::deserialize(serde::de::value::StrDeserializer::<serde::de::value::Error>::new("material; DROP TABLE employees"))}
}
