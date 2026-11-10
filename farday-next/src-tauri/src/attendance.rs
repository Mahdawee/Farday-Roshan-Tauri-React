//! Experimental daily attendance. Batch writes are atomic and revision-checked; no authentication/audit yet.
use serde::{Deserialize,Serialize};
use sqlx::{Row,SqlitePool};
use std::collections::HashSet;
use crate::employees::date_valid;

#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct Entry { status:String, check_in:String, check_out:String, overtime_hundredths:i64, notes:String }
#[derive(Clone,Debug,Serialize,Deserialize)]
pub(crate) struct Change {employee_id:String, record_id:Option<String>, revision:Option<i64>, entry:Option<Entry>}
#[derive(Debug,Serialize)]
pub(crate) struct DayRow {employee_id:String, emp_code:String, full_name:String, father_name:String, job_title:String, employee_status:String, record_id:Option<String>, revision:Option<i64>, entry:Option<Entry>}
fn db_error(e:sqlx::Error)->String {eprintln!("Attendance error: {e}");"عملیات حضور ناموفق بود؛ اطلاعات دوباره بررسی شوند.".into()}
fn date(s:&str)->Result<(),String>{if s.is_empty()||!date_valid(s){Err("تاریخ ورق میلادی معتبر نیست.".into())}else{Ok(())}}
fn time_valid(s:&str)->bool {let b=s.as_bytes();s.is_empty()||(b.len()==5&&b[2]==b':'&&b[0].is_ascii_digit()&&b[1].is_ascii_digit()&&b[3].is_ascii_digit()&&b[4].is_ascii_digit()&&(b[0]-b'0')*10+(b[1]-b'0')<24&&(b[3]-b'0')*10+(b[4]-b'0')<60)}
fn validate(e:&Entry)->Result<(),String>{
    if !matches!(e.status.as_str(),"present"|"absent"|"leave"|"sick"|"holiday"|"friday")||!time_valid(&e.check_in)||!time_valid(&e.check_out)||!(0..=99999).contains(&e.overtime_hundredths)||e.notes.chars().count()>255 {return Err("وضعیت، ساعت، اضافه‌کاری یا ملاحظات معتبر نیست.".into());}Ok(())
}
const STALE:&str="ورق تغییر کرده یا کارمند دیگر وجود ندارد؛ ورق را دوباره بخوانید.";
pub(crate) async fn day(db:&SqlitePool,work_date:String)->Result<Vec<DayRow>,String>{
    date(&work_date)?;
    let rows=sqlx::query("SELECT e.id employee_id,e.emp_code,e.full_name,e.father_name,e.job_title,e.status employee_status,a.record_id,a.status attendance_status,a.check_in,a.check_out,a.overtime_hundredths,a.notes,a.revision FROM employees e LEFT JOIN attendance a ON a.employee_id=e.id AND a.work_date=? WHERE e.status='active' OR a.employee_id IS NOT NULL ORDER BY e.emp_code COLLATE NOCASE,e.id").bind(work_date).fetch_all(db).await.map_err(db_error)?;
    rows.into_iter().map(|r|{
        let status:Option<String>=r.try_get("attendance_status").map_err(db_error)?;
        let entry=match status {None=>None,Some(status)=>Some(Entry{status,check_in:r.try_get::<Option<String>,_>("check_in").map_err(db_error)?.unwrap_or_default(),check_out:r.try_get::<Option<String>,_>("check_out").map_err(db_error)?.unwrap_or_default(),overtime_hundredths:r.try_get("overtime_hundredths").map_err(db_error)?,notes:r.try_get("notes").map_err(db_error)?})};
        Ok(DayRow{employee_id:r.try_get("employee_id").map_err(db_error)?,emp_code:r.try_get("emp_code").map_err(db_error)?,full_name:r.try_get("full_name").map_err(db_error)?,father_name:r.try_get("father_name").map_err(db_error)?,job_title:r.try_get("job_title").map_err(db_error)?,employee_status:r.try_get("employee_status").map_err(db_error)?,record_id:r.try_get("record_id").map_err(db_error)?,revision:r.try_get("revision").map_err(db_error)?,entry})
    }).collect()
}
pub(crate) async fn save(db:&SqlitePool,work_date:String,changes:Vec<Change>)->Result<(),String>{
    date(&work_date)?;
    if changes.is_empty()||changes.len()>10000{return Err("تغییری برای ذخیره وجود ندارد یا تعداد ردیف‌ها بیش از حد است.".into());}
    let mut seen=HashSet::new();
    for c in &changes {
        if c.employee_id.is_empty()||c.employee_id.len()>64||!seen.insert(&c.employee_id)||c.revision.is_some_and(|r|r<1)||c.record_id.as_ref().is_some_and(|id|id.is_empty()||id.len()>64)||c.record_id.is_some()!=c.revision.is_some()||c.revision.is_none()&&c.entry.is_none(){return Err("ردیف حضور نامعتبر یا تکراری است.".into());}
        if let Some(entry)=&c.entry {validate(entry)?;}
    }
    let mut tx=db.begin().await.map_err(db_error)?;
    for c in changes {
        match (c.record_id,c.revision,c.entry) {
            (None,None,Some(e))=>{
                // New records can only be created for active employees; existing records of inactive staff remain editable.
                let active:i64=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM employees WHERE id=? AND status='active')").bind(&c.employee_id).fetch_one(&mut *tx).await.map_err(db_error)?;
                if active==0{return Err(STALE.into());}
                let result=sqlx::query("INSERT INTO attendance(record_id,employee_id,work_date,status,check_in,check_out,overtime_hundredths,notes) VALUES(?,?,?,?,?,?,?,?)").bind(uuid::Uuid::new_v4().to_string()).bind(&c.employee_id).bind(&work_date).bind(&e.status).bind(if e.check_in.is_empty(){None}else{Some(&e.check_in)}).bind(if e.check_out.is_empty(){None}else{Some(&e.check_out)}).bind(e.overtime_hundredths).bind(e.notes.trim()).execute(&mut *tx).await;
                match result {Ok(_)=>{},Err(e) if e.as_database_error().is_some_and(|d|d.is_unique_violation())=>return Err(STALE.into()),Err(e)=>return Err(db_error(e))}
            }
            (Some(record_id),Some(revision),Some(e))=>{
                let n=sqlx::query("UPDATE attendance SET status=?,check_in=?,check_out=?,overtime_hundredths=?,notes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE employee_id=? AND work_date=? AND record_id=? AND revision=?").bind(&e.status).bind(if e.check_in.is_empty(){None}else{Some(&e.check_in)}).bind(if e.check_out.is_empty(){None}else{Some(&e.check_out)}).bind(e.overtime_hundredths).bind(e.notes.trim()).bind(&c.employee_id).bind(&work_date).bind(&record_id).bind(revision).execute(&mut *tx).await.map_err(db_error)?.rows_affected();
                if n!=1{return Err(STALE.into());}
            }
            (Some(record_id),Some(revision),None)=>{
                let n=sqlx::query("DELETE FROM attendance WHERE employee_id=? AND work_date=? AND record_id=? AND revision=?").bind(&c.employee_id).bind(&work_date).bind(&record_id).bind(revision).execute(&mut *tx).await.map_err(db_error)?.rows_affected();if n!=1{return Err(STALE.into());}
            }
            _=>unreachable!(),
        }
    }
    tx.commit().await.map_err(db_error)?;Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;use crate::{open_database,employees};
    fn entry()->Entry {Entry{status:"present".into(),check_in:"08:00".into(),check_out:"16:30".into(),overtime_hundredths:125,notes:"یادداشت".into()}}
    fn change(id:&str,record_id:Option<String>,revision:Option<i64>,entry:Option<Entry>)->Change{Change{employee_id:id.into(),record_id,revision,entry}}
    async fn employee(db:&SqlitePool,id:&str,code:&str){sqlx::query("INSERT INTO employees(id,emp_code,full_name,status) VALUES(?,?,?,'active')").bind(id).bind(code).bind("کارمند").execute(db).await.unwrap();}
    #[tokio::test] async fn atomic_changes_fk_and_reopen(){
        let path=std::env::temp_dir().join(format!("farday-att-{}.sqlite3",uuid::Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();employee(&db,"e1","E1").await;employee(&db,"e2","E2").await;
        let daystr="2024-02-29".to_string();save(&db,daystr.clone(),vec![change("e1",None,None,Some(entry()))]).await.unwrap();
        assert!(employees::delete(&db,"e1".into(),1).await.unwrap_err().contains("سابقهٔ حضور"));
        // FK is enforced even if someone bypasses the domain command.
        assert!(sqlx::query("DELETE FROM employees WHERE id='e1'").execute(&db).await.is_err());
        let mut updated=entry();updated.status="absent".into();
        assert!(save(&db,daystr.clone(),vec![change("e2",None,None,Some(entry())),change("e1",Some("wrong".into()),Some(99),Some(updated))]).await.is_err());
        let rows=day(&db,daystr.clone()).await.unwrap();assert_eq!(rows.iter().filter(|r|r.entry.is_some()).count(),1);assert_eq!(rows[0].entry.as_ref().unwrap().status,"present");
        assert!(save(&db,daystr.clone(),vec![change("e1",None,None,Some(entry()))]).await.is_err());
        sqlx::query("UPDATE employees SET status='inactive' WHERE id='e1'").execute(&db).await.unwrap();
        assert_eq!(day(&db,daystr.clone()).await.unwrap().len(),2);assert!(save(&db,"2024-03-01".into(),vec![change("e1",None,None,Some(entry()))]).await.is_err());
        db.close().await;let db=open_database(path.clone()).await.unwrap();let rows=day(&db,daystr.clone()).await.unwrap();assert_eq!(rows[0].entry.as_ref().unwrap().overtime_hundredths,125);let old_id=rows[0].record_id.clone().unwrap();save(&db,daystr.clone(),vec![change("e1",Some(old_id.clone()),Some(1),None)]).await.unwrap();
        sqlx::query("UPDATE employees SET status='active' WHERE id='e1'").execute(&db).await.unwrap();
        save(&db,daystr.clone(),vec![change("e1",None,None,Some(entry()))]).await.unwrap();
        assert!(save(&db,daystr.clone(),vec![change("e1",Some(old_id),Some(1),None)]).await.is_err());
        let new_id=day(&db,daystr.clone()).await.unwrap()[0].record_id.clone().unwrap();save(&db,daystr.clone(),vec![change("e1",Some(new_id),Some(1),None)]).await.unwrap();employees::delete(&db,"e1".into(),1).await.unwrap();
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[test] fn validates_inputs(){assert!(date("").is_err());assert!(date("2023-02-29").is_err());assert!(date("2024-02-29").is_ok());for s in ["24:00","09:60","9:00","12:00:00"]{assert!(!time_valid(s));}assert!(time_valid("23:59"));let mut e=entry();e.overtime_hundredths=-1;assert!(validate(&e).is_err());e.overtime_hundredths=100000;assert!(validate(&e).is_err());}
}
