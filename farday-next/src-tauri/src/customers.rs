//! Experimental customer master data, not financial statements or authenticated audit.
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct CustomerInput {
    code:String, name:String, contact_person:String, phone:String, vehicle_plate:String,
    opening_balance_minor:String, address:String, notes:String,
}
#[derive(Debug, Serialize)]
pub(crate) struct Customer { id:String, #[serde(flatten)] input:CustomerInput, revision:i64 }
fn message(e:sqlx::Error)->String {
    if e.as_database_error().is_some_and(|db| db.is_unique_violation()) { return "کد مشتری تکراری است.".into(); }
    eprintln!("Customer data error: {e}"); "عملیات مشتری ناموفق بود.".into()
}
fn amount(s:&str)->Result<i64,String> {
    // Canonical integer string only; no floating point, whitespace, exponent or plus sign.
    let valid = s == "0" || (!s.starts_with('0') && s.bytes().all(|b|b.is_ascii_digit())) ||
        (s.starts_with('-') && s.len()>1 && !s[1..].starts_with('0') && s[1..].bytes().all(|b|b.is_ascii_digit()));
    if !valid {return Err("باقی ماندهٔ اولیه معتبر نیست.".into());}
    match s.parse::<i64>() { Ok(n) if (-9_999_999_999_999_999..=9_999_999_999_999_999).contains(&n) => Ok(n), _=>Err("باقی ماندهٔ اولیه از محدودهٔ مجاز بیرون است.".into()) }
}
fn validate(i:&CustomerInput)->Result<i64,String> {
    if i.code.trim().is_empty() || i.name.trim().is_empty() || i.code.chars().count()>20 || i.name.chars().count()>160 || i.contact_person.chars().count()>120 || i.phone.chars().count()>40 || i.vehicle_plate.chars().count()>40 || i.address.chars().count()>255 || i.notes.chars().count()>10000 {return Err("کد، نام یا طول فیلدهای مشتری معتبر نیست.".into());}
    amount(&i.opening_balance_minor)
}
pub(crate) async fn list(db:&SqlitePool)->Result<Vec<Customer>,String> {
    let rows=sqlx::query("SELECT * FROM customers ORDER BY name, id").fetch_all(db).await.map_err(message)?;
    rows.into_iter().map(|r| {let minor:i64=r.try_get("opening_balance_minor").map_err(message)?;Ok(Customer {
        id:r.try_get("id").map_err(message)?,revision:r.try_get("revision").map_err(message)?,input:CustomerInput {
            code:r.try_get("code").map_err(message)?,name:r.try_get("name").map_err(message)?,contact_person:r.try_get("contact_person").map_err(message)?,phone:r.try_get("phone").map_err(message)?,vehicle_plate:r.try_get("vehicle_plate").map_err(message)?,opening_balance_minor:minor.to_string(),address:r.try_get("address").map_err(message)?,notes:r.try_get("notes").map_err(message)?,
        }})}).collect()
}
pub(crate) async fn save(db:&SqlitePool,id:Option<String>,revision:Option<i64>,i:CustomerInput)->Result<(),String> {
    let minor=validate(&i)?;
    match (id,revision) {
        (None,None)=>{sqlx::query("INSERT INTO customers (id,code,name,contact_person,phone,vehicle_plate,opening_balance_minor,address,notes) VALUES (?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(i.code.trim()).bind(i.name.trim()).bind(i.contact_person.trim()).bind(i.phone.trim()).bind(i.vehicle_plate.trim()).bind(minor).bind(i.address.trim()).bind(i.notes.trim()).execute(db).await.map_err(message)?;}
        (Some(id),Some(revision))=>{let n=sqlx::query("UPDATE customers SET code=?,name=?,contact_person=?,phone=?,vehicle_plate=?,opening_balance_minor=?,address=?,notes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?")
            .bind(i.code.trim()).bind(i.name.trim()).bind(i.contact_person.trim()).bind(i.phone.trim()).bind(i.vehicle_plate.trim()).bind(minor).bind(i.address.trim()).bind(i.notes.trim()).bind(id).bind(revision).execute(db).await.map_err(message)?.rows_affected();
            if n!=1 {return Err("مشتری تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}}
        _=>return Err("نسخهٔ قبلی مشتری معتبر نیست.".into()),
    } Ok(())
}
pub(crate) async fn delete(db:&SqlitePool,id:String,revision:i64)->Result<(),String> {
    let n=sqlx::query("DELETE FROM customers WHERE id=? AND revision=?").bind(id).bind(revision).execute(db).await.map_err(message)?.rows_affected();
    if n!=1 {return Err("مشتری تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;use crate::open_database;
    fn input()->CustomerInput{CustomerInput{code:"CUS-001".into(),name:"مشتری".into(),contact_person:"رابط".into(),phone:"0700".into(),vehicle_plate:"123".into(),opening_balance_minor:"9999999999999999".into(),address:"کابل".into(),notes:"نمونه".into()}}
    #[tokio::test]
    async fn customer_crud_exact_amount_and_reopen() {
        let path=std::env::temp_dir().join(format!("farday-next-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        save(&db,None,None,input()).await.unwrap();let mut duplicate=input();duplicate.code="cus-001".into();assert!(save(&db,None,None,duplicate).await.unwrap_err().contains("تکراری"));
        let c=list(&db).await.unwrap().remove(0);assert_eq!(c.input.opening_balance_minor,"9999999999999999");let mut changed=input();changed.opening_balance_minor="-1".into();
        save(&db,Some(c.id.clone()),Some(c.revision),changed).await.unwrap();assert!(delete(&db,c.id.clone(),c.revision).await.is_err());
        let mut invalid=input();invalid.opening_balance_minor="10000000000000000".into();assert!(save(&db,None,None,invalid).await.is_err());
        db.close().await;let db=open_database(path.clone()).await.unwrap();let c=list(&db).await.unwrap().remove(0);assert_eq!(c.input.opening_balance_minor,"-1");assert_eq!(c.input.contact_person,"رابط");delete(&db,c.id,c.revision).await.unwrap();assert!(list(&db).await.unwrap().is_empty());db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[test] fn invalid_amounts_rejected(){for s in ["", "-0", "01", "+1", "1.0", "1e3", "-01", " 1", "9223372036854775808"]{assert!(amount(s).is_err(),"{s}");}assert_eq!(amount("0").unwrap(),0);}
}
