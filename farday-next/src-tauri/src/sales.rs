//! Experimental sales. Not authenticated, audited, reconciled, or accountant-approved.
use serde::{Deserialize,Serialize};
use sqlx::{Row,SqlitePool};
use uuid::Uuid;
use crate::{employees::date_valid,financial};

#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct SaleInput {
    sale_date:String,customer_id:String,material_id:String,bill_no:String,driver_name:String,vehicle_plate:String,destination:String,related_to:String,
    volume_milli:String,unit_price_minor:String,freight_minor:String,payment_type:String,notes:String,
}
#[derive(Debug,Serialize)]
pub(crate) struct Sale {id:String,sale_no:String,#[serde(flatten)] input:SaleInput,total_minor:String,customer_name:String,customer_code:String,material_name:String,material_active:bool,revision:i64}
fn db_error(e:sqlx::Error)->String {eprintln!("Sale error: {e}");"عملیات فروش ناموفق بود.".into()}
const STALE:&str="فروش تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.";
fn validate(i:&SaleInput)->Result<(i64,i64,i64,i64),String>{
    if i.sale_date.is_empty()||!date_valid(&i.sale_date)||i.customer_id.is_empty()||i.customer_id.len()>64||i.material_id.is_empty()||i.material_id.len()>64||i.bill_no.chars().count()>30||i.driver_name.chars().count()>120||i.vehicle_plate.chars().count()>40||i.destination.chars().count()>160||i.related_to.chars().count()>160||i.notes.chars().count()>10000||!matches!(i.payment_type.as_str(),"cash"|"credit"){return Err("تاریخ، مشتری، مواد یا فیلدهای فروش معتبر نیست.".into());}
    let parse=|s:&str,max:i128|->Result<i64,String>{financial::canonical(s,max).map(|n|n as i64).map_err(|_|"عدد فروش معتبر نیست یا خارج از محدوده است.".into())};
    let volume=parse(&i.volume_milli,999_999_999_999)?;let price=parse(&i.unit_price_minor,99_999_999_999_999)?;let freight=parse(&i.freight_minor,99_999_999_999_999)?;
    let total=financial::sale_total(&i.volume_milli,&i.unit_price_minor,&i.freight_minor).map_err(|_|"مجموع فروش از محدودهٔ مجاز بیرون است.".to_string())?.parse::<i64>().map_err(|_|"مجموع فروش معتبر نیست.".to_string())?;
    Ok((volume,price,freight,total))
}
pub(crate) async fn list(db:&SqlitePool)->Result<Vec<Sale>,String>{
    let rows=sqlx::query("SELECT s.*,c.name customer_name,c.code customer_code,m.name material_name,m.active material_active FROM sales s JOIN customers c ON c.id=s.customer_id JOIN material_types m ON m.id=s.material_id ORDER BY s.sale_date DESC,s.sale_no DESC").fetch_all(db).await.map_err(db_error)?;
    rows.into_iter().map(|r|{let volume:i64=r.try_get("volume_milli").map_err(db_error)?;let price:i64=r.try_get("unit_price_minor").map_err(db_error)?;let freight:i64=r.try_get("freight_minor").map_err(db_error)?;let total:i64=r.try_get("total_minor").map_err(db_error)?;let active:i64=r.try_get("material_active").map_err(db_error)?;
        Ok(Sale{id:r.try_get("id").map_err(db_error)?,sale_no:r.try_get("sale_no").map_err(db_error)?,revision:r.try_get("revision").map_err(db_error)?,customer_name:r.try_get("customer_name").map_err(db_error)?,customer_code:r.try_get("customer_code").map_err(db_error)?,material_name:r.try_get("material_name").map_err(db_error)?,material_active:active!=0,total_minor:total.to_string(),input:SaleInput{sale_date:r.try_get("sale_date").map_err(db_error)?,customer_id:r.try_get("customer_id").map_err(db_error)?,material_id:r.try_get("material_id").map_err(db_error)?,bill_no:r.try_get("bill_no").map_err(db_error)?,driver_name:r.try_get("driver_name").map_err(db_error)?,vehicle_plate:r.try_get("vehicle_plate").map_err(db_error)?,destination:r.try_get("destination").map_err(db_error)?,related_to:r.try_get("related_to").map_err(db_error)?,volume_milli:volume.to_string(),unit_price_minor:price.to_string(),freight_minor:freight.to_string(),payment_type:r.try_get("payment_type").map_err(db_error)?,notes:r.try_get("notes").map_err(db_error)?}})}).collect()
}
pub(crate) async fn save(db:&SqlitePool,id:Option<String>,revision:Option<i64>,i:SaleInput)->Result<(),String>{
    let (volume,price,freight,total)=validate(&i)?;
    if id.is_some()!=revision.is_some(){return Err("نسخهٔ فروش معتبر نیست.".into());}
    let mut tx=db.begin().await.map_err(db_error)?;
    let old_material:Option<String>=if let (Some(id),Some(revision))=(&id,revision){Some(sqlx::query_scalar("SELECT material_id FROM sales WHERE id=? AND revision=?").bind(id).bind(revision).fetch_optional(&mut *tx).await.map_err(db_error)?.ok_or(STALE)?)}else{None};
    let customer:i64=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM customers WHERE id=?)").bind(&i.customer_id).fetch_one(&mut *tx).await.map_err(db_error)?;
    let material:Option<i64>=sqlx::query_scalar("SELECT active FROM material_types WHERE id=?").bind(&i.material_id).fetch_optional(&mut *tx).await.map_err(db_error)?;
    if customer==0||material.is_none()||(material==Some(0)&&old_material.as_deref()!=Some(i.material_id.as_str())){return Err("مشتری وجود ندارد یا مواد انتخاب‌شده فعال نیست.".into());}
    if let (Some(id),Some(revision))=(id,revision){
        let n=sqlx::query("UPDATE sales SET sale_date=?,customer_id=?,material_id=?,bill_no=?,driver_name=?,vehicle_plate=?,destination=?,related_to=?,volume_milli=?,unit_price_minor=?,freight_minor=?,total_minor=?,payment_type=?,notes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?")
            .bind(&i.sale_date).bind(&i.customer_id).bind(&i.material_id).bind(i.bill_no.trim()).bind(i.driver_name.trim()).bind(i.vehicle_plate.trim()).bind(i.destination.trim()).bind(i.related_to.trim()).bind(volume).bind(price).bind(freight).bind(total).bind(&i.payment_type).bind(i.notes.trim()).bind(id).bind(revision).execute(&mut *tx).await.map_err(db_error)?.rows_affected();if n!=1{return Err(STALE.into());}
    }else{
        let year:i64=i.sale_date[..4].parse().map_err(|_|"سال فروش معتبر نیست.")?;
        let number:i64=sqlx::query_scalar("INSERT INTO sales_counters(year,last_number) VALUES(?,1) ON CONFLICT(year) DO UPDATE SET last_number=last_number+1 RETURNING last_number").bind(year).fetch_one(&mut *tx).await.map_err(db_error)?;
        let sale_no=format!("S-{year:04}-{number:04}");
        sqlx::query("INSERT INTO sales(id,sale_no,sale_date,customer_id,material_id,bill_no,driver_name,vehicle_plate,destination,related_to,volume_milli,unit_price_minor,freight_minor,total_minor,payment_type,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(sale_no).bind(&i.sale_date).bind(&i.customer_id).bind(&i.material_id).bind(i.bill_no.trim()).bind(i.driver_name.trim()).bind(i.vehicle_plate.trim()).bind(i.destination.trim()).bind(i.related_to.trim()).bind(volume).bind(price).bind(freight).bind(total).bind(&i.payment_type).bind(i.notes.trim()).execute(&mut *tx).await.map_err(db_error)?;
    }tx.commit().await.map_err(db_error)?;Ok(())
}
pub(crate) async fn delete(db:&SqlitePool,id:String,revision:i64)->Result<(),String>{let n=sqlx::query("DELETE FROM sales WHERE id=? AND revision=?").bind(id).bind(revision).execute(db).await.map_err(db_error)?.rows_affected();if n!=1{return Err(STALE.into());}Ok(())}
#[cfg(test)]
mod tests{
    use super::*;use crate::{open_database,customers,lookups};
    fn input()->SaleInput{SaleInput{sale_date:"2024-02-29".into(),customer_id:"customer".into(),material_id:"material".into(),bill_no:"B1".into(),driver_name:"راننده".into(),vehicle_plate:"123".into(),destination:"کابل".into(),related_to:"مرتبط".into(),volume_milli:"10000".into(),unit_price_minor:"50000".into(),freight_minor:"30000".into(),payment_type:"credit".into(),notes:"آزمایشی".into()}}
    #[tokio::test] async fn sale_atomic_number_exact_foreign_keys_and_reopen(){
        let path=std::env::temp_dir().join(format!("farday-sale-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('customer','C1','مشتری')").execute(&db).await.unwrap();sqlx::query("INSERT INTO material_types(id,name,unit,active,sort_order) VALUES('material','ریگ','متر',1,10)").execute(&db).await.unwrap();
        let mut invalid=input();invalid.material_id="missing".into();assert!(save(&db,None,None,invalid).await.is_err());save(&db,None,None,input()).await.unwrap();let a=list(&db).await.unwrap().remove(0);assert_eq!(a.sale_no,"S-2024-0001");assert_eq!(a.total_minor,"800000");
        assert!(customers::delete(&db,"customer".into(),1).await.is_err());assert!(lookups::delete(&db,lookups::Kind::Material,"material".into(),1).await.is_err());assert!(sqlx::query("DELETE FROM customers WHERE id='customer'").execute(&db).await.is_err());
        let mut changed=input();changed.sale_date="2025-01-01".into();changed.freight_minor="0".into();save(&db,Some(a.id.clone()),Some(a.revision),changed).await.unwrap();assert!(delete(&db,a.id.clone(),a.revision).await.is_err());let b=list(&db).await.unwrap().remove(0);assert_eq!(b.sale_no,a.sale_no);assert_eq!(b.total_minor,"500000");
        delete(&db,b.id,b.revision).await.unwrap();save(&db,None,None,input()).await.unwrap();assert_eq!(list(&db).await.unwrap()[0].sale_no,"S-2024-0002");db.close().await;
        let db=open_database(path.clone()).await.unwrap();assert_eq!(list(&db).await.unwrap().len(),1);db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[test] fn validation_refuses_out_of_range_and_date(){let mut i=input();i.sale_date="2023-02-29".into();assert!(validate(&i).is_err());i=input();i.volume_milli="1000000000000".into();assert!(validate(&i).is_err());i=input();i.unit_price_minor="1.2".into();assert!(validate(&i).is_err());}
}
