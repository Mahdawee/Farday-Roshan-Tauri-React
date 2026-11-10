//! Company and machinery preview. No access control or authenticated audit yet.
use serde::{Deserialize,Serialize};
use sqlx::{Row,SqlitePool};
use uuid::Uuid;

#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct CompanyInput {
    name:String,activity_type:String,address:String,finance_manager:String,supervisor:String,
    fiscal_year_note:String,employees_count:i64,phone:String,email:String,license_no:String,notes:String,
}
#[derive(Debug,Serialize)]
pub(crate) struct Company { #[serde(flatten)] input:CompanyInput,revision:i64 }
#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct MachineInput {name:String,count:i64,status:String,notes:String,sort_order:i64}
#[derive(Debug,Serialize)]
pub(crate) struct Machine {id:String,#[serde(flatten)] input:MachineInput,revision:i64}
#[derive(Serialize)]
pub(crate) struct Snapshot {company:Company,machines:Vec<Machine>}
fn error(e:sqlx::Error)->String {eprintln!("Company data error: {e}");"عملیات مشخصات شرکت ناموفق بود.".into()}
fn bounded(s:&str,max:usize)->bool {s.chars().count()<=max}
fn validate_company(i:&CompanyInput)->Result<(),String> {
    if i.name.trim().is_empty() || !bounded(&i.name,120) || !bounded(&i.activity_type,120) || !bounded(&i.address,255) || !bounded(&i.finance_manager,120) || !bounded(&i.supervisor,120) || !bounded(&i.fiscal_year_note,60) || !bounded(&i.phone,60) || !bounded(&i.email,120) || !bounded(&i.license_no,60) || !bounded(&i.notes,10000) || !(0..=2147483647).contains(&i.employees_count) {return Err("نام شرکت و طول فیلدها یا تعداد کارمندان معتبر نیست.".into());}
    Ok(())
}
fn validate_machine(i:&MachineInput)->Result<(),String> {
    if i.name.trim().is_empty() || !bounded(&i.name,120) || !bounded(&i.notes,255) || !(1..=2147483647).contains(&i.count) || !(-2147483648..=2147483647).contains(&i.sort_order) || !matches!(i.status.as_str(),"active"|"inactive"|"repair") {return Err("معلومات ماشینری معتبر نیست؛ نام، تعداد، ترتیب و وضعیت را بررسی کنید.".into());} Ok(())
}
pub(crate) async fn snapshot(db:&SqlitePool)->Result<Snapshot,String> {
    let mut tx=db.begin().await.map_err(error)?;
    let r=sqlx::query("SELECT * FROM company WHERE id=1").fetch_one(&mut *tx).await.map_err(error)?;
    let company=Company{input:CompanyInput{name:r.try_get("name").map_err(error)?,activity_type:r.try_get("activity_type").map_err(error)?,address:r.try_get("address").map_err(error)?,finance_manager:r.try_get("finance_manager").map_err(error)?,supervisor:r.try_get("supervisor").map_err(error)?,fiscal_year_note:r.try_get("fiscal_year_note").map_err(error)?,employees_count:r.try_get("employees_count").map_err(error)?,phone:r.try_get("phone").map_err(error)?,email:r.try_get("email").map_err(error)?,license_no:r.try_get("license_no").map_err(error)?,notes:r.try_get("notes").map_err(error)?},revision:r.try_get("revision").map_err(error)?};
    let rows=sqlx::query("SELECT * FROM machines ORDER BY sort_order,id").fetch_all(&mut *tx).await.map_err(error)?;
    let machines=rows.into_iter().map(|r|Ok(Machine{id:r.try_get("id").map_err(error)?,input:MachineInput{name:r.try_get("name").map_err(error)?,count:r.try_get("count").map_err(error)?,status:r.try_get("status").map_err(error)?,notes:r.try_get("notes").map_err(error)?,sort_order:r.try_get("sort_order").map_err(error)?},revision:r.try_get("revision").map_err(error)?})).collect::<Result<Vec<_>,String>>()?;
    tx.commit().await.map_err(error)?;Ok(Snapshot{company,machines})
}
pub(crate) async fn save_company(db:&SqlitePool,i:CompanyInput,revision:i64)->Result<(),String> {
    validate_company(&i)?;
    let n=sqlx::query("UPDATE company SET name=?,activity_type=?,address=?,finance_manager=?,supervisor=?,fiscal_year_note=?,employees_count=?,phone=?,email=?,license_no=?,notes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND revision=?")
        .bind(i.name.trim()).bind(i.activity_type.trim()).bind(i.address.trim()).bind(i.finance_manager.trim()).bind(i.supervisor.trim()).bind(i.fiscal_year_note.trim()).bind(i.employees_count).bind(i.phone.trim()).bind(i.email.trim()).bind(i.license_no.trim()).bind(i.notes.trim()).bind(revision).execute(db).await.map_err(error)?.rows_affected();
    if n!=1{return Err("مشخصات شرکت تغییر کرده است؛ صفحه را دوباره باز کنید.".into());}Ok(())
}
pub(crate) async fn save_machine(db:&SqlitePool,id:Option<String>,revision:Option<i64>,i:MachineInput)->Result<(),String> {
    validate_machine(&i)?;
    match (id,revision) {
        (None,None)=>{sqlx::query("INSERT INTO machines(id,name,count,status,notes,sort_order) VALUES(?,?,?,?,?,?)").bind(Uuid::new_v4().to_string()).bind(i.name.trim()).bind(i.count).bind(i.status).bind(i.notes.trim()).bind(i.sort_order).execute(db).await.map_err(error)?;}
        (Some(id),Some(revision))=>{let n=sqlx::query("UPDATE machines SET name=?,count=?,status=?,notes=?,sort_order=?,revision=revision+1 WHERE id=? AND revision=?")
            .bind(i.name.trim()).bind(i.count).bind(i.status).bind(i.notes.trim()).bind(i.sort_order).bind(id).bind(revision).execute(db).await.map_err(error)?.rows_affected();
            if n!=1{return Err("ماشینری تغییر کرده یا وجود ندارد؛ صفحه را دوباره باز کنید.".into());}}
        _=>return Err("نسخهٔ قبلی ماشینری معتبر نیست.".into()),
    } Ok(())
}
pub(crate) async fn delete_machine(db:&SqlitePool,id:String,revision:i64)->Result<(),String> {
    let n=sqlx::query("DELETE FROM machines WHERE id=? AND revision=?").bind(id).bind(revision).execute(db).await.map_err(error)?.rows_affected();
    if n!=1{return Err("ماشینری تغییر کرده یا وجود ندارد؛ صفحه را دوباره باز کنید.".into());} Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;use crate::open_database;
    fn machine()->MachineInput{MachineInput{name:"لودر".into(),count:2,status:"active".into(),notes:"".into(),sort_order:10}}
    #[tokio::test]
    async fn data_survives_reopen_and_stale_changes_are_rejected(){
        let path=std::env::temp_dir().join(format!("farday-next-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        let mut first=snapshot(&db).await.unwrap().company.input;first.name="شرکت آزمایشی".into();first.license_no="123".into();
        save_company(&db,first.clone(),1).await.unwrap();assert!(save_company(&db,first,1).await.is_err());
        save_machine(&db,None,None,machine()).await.unwrap();let m=snapshot(&db).await.unwrap().machines.remove(0);
        assert!(save_machine(&db,Some(m.id.clone()),None,machine()).await.is_err());
        let mut change=machine();change.status="repair".into();save_machine(&db,Some(m.id.clone()),Some(m.revision),change).await.unwrap();
        assert!(delete_machine(&db,m.id.clone(),m.revision).await.is_err());
        let current=snapshot(&db).await.unwrap().machines.remove(0);assert_eq!(current.input.status,"repair");
        let mut invalid=machine();invalid.count=0;assert!(save_machine(&db,None,None,invalid).await.is_err());
        db.close().await;let db=open_database(path.clone()).await.unwrap();let snap=snapshot(&db).await.unwrap();assert_eq!(snap.company.input.license_no,"123");assert_eq!(snap.machines.len(),1);
        delete_machine(&db,current.id,current.revision).await.unwrap();assert!(snapshot(&db).await.unwrap().machines.is_empty());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
