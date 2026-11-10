use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool, SqliteConnection};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize, Clone)]
pub(crate) struct EmployeeInput {
    code: String, name: String, father_name: String, job_title: String,
    hire_date: Option<String>, base_salary: String, phone: String, status: String,
}
#[derive(Serialize)]
pub(crate) struct Employee {
    id: String, code: String, name: String, father_name: String, job_title: String,
    hire_date: Option<String>, base_salary: String, phone: String, status: String,
}
fn error(err: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref detail) = err {
        if detail.is_unique_violation() { return "کد کارمند قبلاً ثبت شده است.".into(); }
    }
    eprintln!("Employee database error: {err}");
    "عملیات کارمند انجام نشد؛ دوباره تلاش کنید.".into()
}

pub(crate) async fn list(db: &SqlitePool) -> Result<Vec<Employee>, String> {
    let rows = sqlx::query("SELECT id,code,name,father_name,job_title,hire_date,base_salary_cents,phone,status FROM employees ORDER BY name,id")
        .fetch_all(db).await.map_err(error)?;
    rows.into_iter().map(|r| Ok(Employee {
        id: r.try_get("id").map_err(error)?, code: r.try_get("code").map_err(error)?,
        name: r.try_get("name").map_err(error)?, father_name: r.try_get("father_name").map_err(error)?,
        job_title: r.try_get("job_title").map_err(error)?, hire_date: r.try_get("hire_date").map_err(error)?,
        base_salary: money(r.try_get("base_salary_cents").map_err(error)?),
        phone: r.try_get("phone").map_err(error)?, status: r.try_get("status").map_err(error)?,
    })).collect()
}

pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: EmployeeInput, expected: Option<EmployeeInput>) -> Result<(), String> {
    let mut conn=db.acquire().await.map_err(error)?;
    save_on(&mut conn,id,input,expected).await.map(|_| ())
}
pub(crate) async fn save_on(db:&mut SqliteConnection, id:Option<String>, input:EmployeeInput, expected:Option<EmployeeInput>)->Result<String,String> {
    let row_id=id.clone().unwrap_or_else(||Uuid::new_v4().to_string());
    let code = input.code.trim(); let name = input.name.trim();
    let father = input.father_name.trim(); let title = input.job_title.trim(); let phone = input.phone.trim();
    if code.is_empty() || name.is_empty() { return Err("کد و نام کارمند الزامی است.".into()); }
    if code.len() > 80 || name.len() > 320 || father.len() > 320 || title.len() > 240 || phone.len() > 120 {
        return Err("متن واردشده بیش از حد طولانی است.".into());
    }
    if !matches!(input.status.as_str(), "active" | "inactive") { return Err("وضعیت کارمند معتبر نیست.".into()); }
    if let Some(ref date) = input.hire_date { valid_date(date)?; }
    let salary = scaled(&input.base_salary, 2)?;
    if let Some(id) = id {
        let previous = expected.ok_or("نسخهٔ قبلی کارمند برای ویرایش لازم است؛ فرم را دوباره باز کنید.")?;
        let old_salary = scaled(&previous.base_salary, 2)?;
        let changed = sqlx::query("UPDATE employees SET code=?,name=?,father_name=?,job_title=?,hire_date=?,base_salary_cents=?,phone=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code COLLATE BINARY=? AND name=? AND father_name=? AND job_title=? AND hire_date IS ? AND base_salary_cents=? AND phone=? AND status=?")
            .bind(code).bind(name).bind(father).bind(title).bind(&input.hire_date).bind(salary).bind(phone).bind(input.status).bind(id)
            .bind(previous.code).bind(previous.name).bind(previous.father_name).bind(previous.job_title).bind(previous.hire_date).bind(old_salary).bind(previous.phone).bind(previous.status)
            .execute(&mut *db).await.map_err(error)?.rows_affected();
        if changed == 0 { return Err("کارمند تغییر کرده یا وجود ندارد؛ فرم را ببندید و دوباره باز کنید.".into()); }
    } else {
        if expected.is_some() { return Err("نسخهٔ قبلی برای کارمند جدید قابل استفاده نیست.".into()); }
        sqlx::query("INSERT INTO employees(id,code,name,father_name,job_title,hire_date,base_salary_cents,phone,status) VALUES(?,?,?,?,?,?,?,?,?)")
            .bind(&row_id).bind(code).bind(name).bind(father).bind(title).bind(&input.hire_date).bind(salary).bind(phone).bind(input.status)
            .execute(&mut *db).await.map_err(error)?;
    }
    Ok(row_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::open_database;
    fn input(code: &str) -> EmployeeInput { EmployeeInput { code: code.into(), name: "محمد".into(), father_name: "احمد".into(), job_title: "راننده".into(), hire_date: Some("2026-03-21".into()), base_salary: "12345.50".into(), phone: "0700".into(), status: "active".into() } }
    #[tokio::test]
    async fn employee_edits_compare_the_opened_state_atomically() {
        let path = std::env::temp_dir().join(format!("employees-cas-{}.sqlite3", Uuid::new_v4()));
        let first = open_database(path.clone()).await.unwrap();
        let second = open_database(path.clone()).await.unwrap();
        let mut original = input("EMP-1"); original.hire_date = None;
        save(&first,None,original.clone(),None).await.unwrap();
        let id = list(&first).await.unwrap().remove(0).id;
        assert!(save(&first,Some(id.clone()),original.clone(),None).await.is_err());
        assert!(save(&first,None,input("EMP-2"),Some(original.clone())).await.is_err());
        let mut one=original.clone(); one.code="emp-1".into();
        let mut two=original.clone(); two.base_salary="999".into();
        let (a,b)=tokio::join!(save(&first,Some(id.clone()),one,Some(original.clone())),save(&second,Some(id.clone()),two,Some(original.clone())));
        assert_ne!(a.is_ok(),b.is_ok());
        let loser = if let Err(e)=a {e} else {b.unwrap_err()};
        assert!(loser.contains("کارمند تغییر کرده"), "unexpected error: {loser}");
        let current=list(&first).await.unwrap().remove(0);
        assert!(current.code=="emp-1" && current.base_salary=="12345.50" || current.code=="EMP-1" && current.base_salary=="999.00");
        let old=EmployeeInput{code:current.code,name:current.name,father_name:current.father_name,job_title:current.job_title,hire_date:current.hire_date,base_salary:current.base_salary,phone:current.phone,status:current.status};
        let mut case_only=old.clone();case_only.code=if old.code=="EMP-1" {"emp-1"} else {"EMP-1"}.into();
        save(&first,Some(id.clone()),case_only,Some(old.clone())).await.unwrap();
        assert!(save(&second,Some(id),old.clone(),Some(old)).await.unwrap_err().contains("کارمند تغییر کرده"));
        first.close().await; second.close().await; std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn employee_create_edit_validation_and_persistence() {
        let path = std::env::temp_dir().join(format!("employees-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        save(&db, None, input("EMP-1"), None).await.unwrap();
        assert!(save(&db, None, input("emp-1"), None).await.is_err());
        let staff = list(&db).await.unwrap();
        assert_eq!(staff[0].base_salary, "12345.50");
        let id = staff[0].id.clone();
        let mut change = input("EMP-1"); change.status = "inactive".into();
        save(&db, Some(id), change, Some(input("EMP-1"))).await.unwrap();
        let mut invalid = input("EMP-2"); invalid.hire_date = Some("2025-02-29".into());
        assert!(save(&db, None, invalid, None).await.is_err());
        assert!(save(&db, Some("missing".into()), input("EMP-X"), Some(input("EMP-X"))).await.is_err());
        db.close().await;
        let db = open_database(path.clone()).await.unwrap();
        let staff = list(&db).await.unwrap();
        assert_eq!(staff.len(), 1); assert_eq!(staff[0].status, "inactive");
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
