use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize)]
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

pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: EmployeeInput) -> Result<(), String> {
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
        let changed = sqlx::query("UPDATE employees SET code=?,name=?,father_name=?,job_title=?,hire_date=?,base_salary_cents=?,phone=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(code).bind(name).bind(father).bind(title).bind(&input.hire_date).bind(salary).bind(phone).bind(input.status).bind(id)
            .execute(db).await.map_err(error)?.rows_affected();
        if changed == 0 { return Err("کارمند انتخاب‌شده وجود ندارد.".into()); }
    } else {
        sqlx::query("INSERT INTO employees(id,code,name,father_name,job_title,hire_date,base_salary_cents,phone,status) VALUES(?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(code).bind(name).bind(father).bind(title).bind(&input.hire_date).bind(salary).bind(phone).bind(input.status)
            .execute(db).await.map_err(error)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::open_database;
    fn input(code: &str) -> EmployeeInput { EmployeeInput { code: code.into(), name: "محمد".into(), father_name: "احمد".into(), job_title: "راننده".into(), hire_date: Some("2026-03-21".into()), base_salary: "12345.50".into(), phone: "0700".into(), status: "active".into() } }
    #[tokio::test]
    async fn employee_create_edit_validation_and_persistence() {
        let path = std::env::temp_dir().join(format!("employees-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        save(&db, None, input("EMP-1")).await.unwrap();
        assert!(save(&db, None, input("emp-1")).await.is_err());
        let staff = list(&db).await.unwrap();
        assert_eq!(staff[0].base_salary, "12345.50");
        let id = staff[0].id.clone();
        let mut change = input("EMP-1"); change.status = "inactive".into();
        save(&db, Some(id), change).await.unwrap();
        let mut invalid = input("EMP-2"); invalid.hire_date = Some("2025-02-29".into());
        assert!(save(&db, None, invalid).await.is_err());
        assert!(save(&db, Some("missing".into()), input("EMP-X")).await.is_err());
        db.close().await;
        let db = open_database(path.clone()).await.unwrap();
        let staff = list(&db).await.unwrap();
        assert_eq!(staff.len(), 1); assert_eq!(staff[0].status, "inactive");
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
