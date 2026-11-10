//! Experimental employee master data; not payroll, attendance, or an authenticated record.
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct EmployeeInput {
    emp_code:String, full_name:String, father_name:String, job_title:String, hire_date:String,
    base_salary_minor:String, phone:String, tazkira_no:String, address:String,
    contract_duration:String, status:String, notes:String,
}
#[derive(Debug, Serialize)]
pub(crate) struct Employee { id:String, #[serde(flatten)] input:EmployeeInput, revision:i64 }
fn message(e:sqlx::Error)->String {
    if e.as_database_error().is_some_and(|db|db.is_unique_violation()){return "کد کارمند تکراری است.".into();}
    eprintln!("Employee data error: {e}");"عملیات کارمند ناموفق بود.".into()
}
fn date_valid(s:&str)->bool {
    if s.is_empty(){return true;}
    let b=s.as_bytes();
    if b.len()!=10 || b[4]!=b'-' || b[7]!=b'-' || !b.iter().enumerate().all(|(i,c)|i==4||i==7||c.is_ascii_digit()){return false;}
    let year=(b[0]-b'0') as u32*1000+(b[1]-b'0') as u32*100+(b[2]-b'0') as u32*10+(b[3]-b'0') as u32;
    let month=(b[5]-b'0')*10+(b[6]-b'0');let day=(b[8]-b'0')*10+(b[9]-b'0');
    let days=match month {1|3|5|7|8|10|12=>31,4|6|9|11=>30,2 if year%400==0||(year%4==0&&year%100!=0)=>29,2=>28,_=>0};
    year>=1 && day>=1 && day<=days
}
fn salary(s:&str)->Result<i64,String> {
    let valid=s=="0"||(!s.is_empty()&&!s.starts_with('0')&&s.bytes().all(|b|b.is_ascii_digit()))||(s.starts_with('-')&&s.len()>1&&!s[1..].starts_with('0')&&s[1..].bytes().all(|b|b.is_ascii_digit()));
    if !valid {return Err("معاش ثابت معتبر نیست.".into());}
    match s.parse::<i64>() {Ok(n) if (-99_999_999_999_999..=99_999_999_999_999).contains(&n)=>Ok(n),_=>Err("معاش ثابت از محدودهٔ مجاز بیرون است.".into())}
}
fn validate(i:&EmployeeInput)->Result<i64,String> {
    if i.emp_code.trim().is_empty()||i.full_name.trim().is_empty()||i.emp_code.chars().count()>20||i.full_name.chars().count()>120||i.father_name.chars().count()>120||i.job_title.chars().count()>80||i.phone.chars().count()>40||i.tazkira_no.chars().count()>40||i.address.chars().count()>255||i.contract_duration.chars().count()>60||i.notes.chars().count()>10000||!matches!(i.status.as_str(),"active"|"inactive") {return Err("کد، نام، وضعیت یا طول فیلدهای کارمند معتبر نیست.".into());}
    if !date_valid(&i.hire_date){return Err("تاریخ استخدام میلادی معتبر نیست.".into());}salary(&i.base_salary_minor)
}
pub(crate) async fn list(db:&SqlitePool)->Result<Vec<Employee>,String> {
    let rows=sqlx::query("SELECT * FROM employees ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, emp_code COLLATE NOCASE, id").fetch_all(db).await.map_err(message)?;
    rows.into_iter().map(|r| {let minor:i64=r.try_get("base_salary_minor").map_err(message)?;let date:Option<String>=r.try_get("hire_date").map_err(message)?;Ok(Employee{
        id:r.try_get("id").map_err(message)?,revision:r.try_get("revision").map_err(message)?,input:EmployeeInput{
            emp_code:r.try_get("emp_code").map_err(message)?,full_name:r.try_get("full_name").map_err(message)?,father_name:r.try_get("father_name").map_err(message)?,job_title:r.try_get("job_title").map_err(message)?,hire_date:date.unwrap_or_default(),base_salary_minor:minor.to_string(),phone:r.try_get("phone").map_err(message)?,tazkira_no:r.try_get("tazkira_no").map_err(message)?,address:r.try_get("address").map_err(message)?,contract_duration:r.try_get("contract_duration").map_err(message)?,status:r.try_get("status").map_err(message)?,notes:r.try_get("notes").map_err(message)?,
        }})}).collect()
}
pub(crate) async fn save(db:&SqlitePool,id:Option<String>,revision:Option<i64>,i:EmployeeInput)->Result<(),String> {
    let amount=validate(&i)?;let date=if i.hire_date.is_empty(){None}else{Some(i.hire_date.as_str())};
    match (id,revision) {
        (None,None)=>{sqlx::query("INSERT INTO employees(id,emp_code,full_name,father_name,job_title,hire_date,base_salary_minor,phone,tazkira_no,address,contract_duration,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(i.emp_code.trim()).bind(i.full_name.trim()).bind(i.father_name.trim()).bind(i.job_title.trim()).bind(date).bind(amount).bind(i.phone.trim()).bind(i.tazkira_no.trim()).bind(i.address.trim()).bind(i.contract_duration.trim()).bind(&i.status).bind(i.notes.trim()).execute(db).await.map_err(message)?;}
        (Some(id),Some(revision))=>{let n=sqlx::query("UPDATE employees SET emp_code=?,full_name=?,father_name=?,job_title=?,hire_date=?,base_salary_minor=?,phone=?,tazkira_no=?,address=?,contract_duration=?,status=?,notes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?")
            .bind(i.emp_code.trim()).bind(i.full_name.trim()).bind(i.father_name.trim()).bind(i.job_title.trim()).bind(date).bind(amount).bind(i.phone.trim()).bind(i.tazkira_no.trim()).bind(i.address.trim()).bind(i.contract_duration.trim()).bind(&i.status).bind(i.notes.trim()).bind(id).bind(revision).execute(db).await.map_err(message)?.rows_affected();
            if n!=1{return Err("کارمند تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}}
        _=>return Err("نسخهٔ قبلی کارمند معتبر نیست.".into()),
    } Ok(())
}
pub(crate) async fn delete(db:&SqlitePool,id:String,revision:i64)->Result<(),String> {
    let n=sqlx::query("DELETE FROM employees WHERE id=? AND revision=?").bind(id).bind(revision).execute(db).await.map_err(message)?.rows_affected();
    if n!=1{return Err("کارمند تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.".into());}Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;use crate::open_database;
    fn input()->EmployeeInput{EmployeeInput{emp_code:"EMP-001".into(),full_name:"احمد".into(),father_name:"علی".into(),job_title:"دریور".into(),hire_date:"2024-02-29".into(),base_salary_minor:"99999999999999".into(),phone:"0700".into(),tazkira_no:"۱۲۳".into(),address:"کابل".into(),contract_duration:"یک سال".into(),status:"active".into(),notes:"آزمایشی".into()}}
    #[test] fn validation_checks_gregorian_date_and_exact_amount(){for s in ["2023-02-29","1900-02-29","0000-01-01","2024-04-31","2024-2-01","9999-99-99"]{assert!(!date_valid(s),"{s}");}for s in ["","2000-02-29","2024-02-29"]{assert!(date_valid(s),"{s}");}for s in ["","-0","01","1e3","100000000000000","-100000000000000"]{assert!(salary(s).is_err(),"{s}");}}
    #[tokio::test] async fn crud_and_reopen(){
        let path=std::env::temp_dir().join(format!("farday-employee-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        save(&db,None,None,input()).await.unwrap();let mut duplicate=input();duplicate.emp_code="emp-001".into();assert!(save(&db,None,None,duplicate).await.unwrap_err().contains("تکراری"));
        let e=list(&db).await.unwrap().remove(0);assert_eq!(e.input.base_salary_minor,"99999999999999");let mut updated=input();updated.status="inactive".into();updated.hire_date="".into();updated.base_salary_minor="-1".into();save(&db,Some(e.id.clone()),Some(e.revision),updated).await.unwrap();assert!(delete(&db,e.id,e.revision).await.is_err());
        let mut invalid=input();invalid.hire_date="2023-02-29".into();assert!(save(&db,None,None,invalid).await.is_err());
        db.close().await;let db=open_database(path.clone()).await.unwrap();let e=list(&db).await.unwrap().remove(0);assert_eq!(e.input.base_salary_minor,"-1");assert_eq!(e.input.hire_date,"");assert_eq!(e.input.contract_duration,"یک سال");delete(&db,e.id,e.revision).await.unwrap();assert!(list(&db).await.unwrap().is_empty());db.close().await;std::fs::remove_file(path).unwrap();
    }
}
