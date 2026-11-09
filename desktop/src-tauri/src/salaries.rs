use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize, Clone)]
pub(crate) struct SalaryInput {
    employee_id: String, period_calendar: String, period_year: i64, period_month: i64, pay_date: String,
    base: String, bonus: String, fine: String, overtime: String, payer: String, payment_type: String, notes: String,
}
#[derive(Serialize)]
pub(crate) struct Salary {
    id: String, employee_id: String, employee_name: String, employee_code: String,
    period_calendar: String, period_year: i64, period_month: i64, pay_date: String,
    base: String, bonus: String, fine: String, overtime: String, total: String,
    payer: String, payment_type: String, notes: String,
}
fn error(err: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref detail) = err {
        if detail.is_foreign_key_violation() { return "کارمند انتخاب‌شده وجود ندارد.".into(); }
    }
    eprintln!("Salary database error: {err}"); "عملیات معاش انجام نشد؛ دوباره تلاش کنید.".into()
}
pub(crate) fn valid_period(calendar: &str, year: i64, month: i64) -> bool {
    (1..=12).contains(&month) && match calendar { "shamsi" => (1..=3177).contains(&year), "miladi" => (1..=9999).contains(&year), _ => false }
}
pub(crate) async fn list(db: &SqlitePool) -> Result<Vec<Salary>, String> {
    let rows = sqlx::query("SELECT s.*,e.name AS employee_name,e.code AS employee_code FROM salaries s JOIN employees e ON e.id=s.employee_id ORDER BY s.pay_date DESC,s.created_at DESC,s.id DESC").fetch_all(db).await.map_err(error)?;
    rows.into_iter().map(|r| Ok(Salary {
        id:r.try_get("id").map_err(error)?, employee_id:r.try_get("employee_id").map_err(error)?, employee_name:r.try_get("employee_name").map_err(error)?, employee_code:r.try_get("employee_code").map_err(error)?,
        period_calendar:r.try_get("period_calendar").map_err(error)?, period_year:r.try_get("period_year").map_err(error)?, period_month:r.try_get("period_month").map_err(error)?, pay_date:r.try_get("pay_date").map_err(error)?,
        base:money(r.try_get("base_cents").map_err(error)?), bonus:money(r.try_get("bonus_cents").map_err(error)?), fine:money(r.try_get("fine_cents").map_err(error)?), overtime:money(r.try_get("overtime_cents").map_err(error)?), total:money(r.try_get("total_cents").map_err(error)?),
        payer:r.try_get("payer").map_err(error)?, payment_type:r.try_get("payment_type").map_err(error)?, notes:r.try_get("notes").map_err(error)?,
    })).collect()
}
pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: SalaryInput, expected: Option<SalaryInput>) -> Result<(), String> {
    valid_date(&input.pay_date)?;
    if !valid_period(&input.period_calendar, input.period_year, input.period_month) { return Err("دورهٔ معاش معتبر نیست.".into()); }
    if !matches!(input.payment_type.as_str(), "cash" | "transfer") { return Err("نوع پرداخت معتبر نیست.".into()); }
    let payer = input.payer.trim(); let notes = input.notes.trim();
    if payer.len() > 320 || notes.len() > 4000 { return Err("متن واردشده بیش از حد طولانی است.".into()); }
    let base=scaled(&input.base,2)?; let bonus=scaled(&input.bonus,2)?; let fine=scaled(&input.fine,2)?; let overtime=scaled(&input.overtime,2)?;
    // Bounded inputs make this exact integer calculation safe in i64, even if negative.
    let total=base+bonus+overtime-fine;
    if let Some(id) = id {
        let expected=expected.ok_or("نسخهٔ قبلی معاش لازم است؛ فرم را دوباره باز کنید.")?;
        let old_base=scaled(&expected.base,2)?; let old_bonus=scaled(&expected.bonus,2)?; let old_fine=scaled(&expected.fine,2)?; let old_overtime=scaled(&expected.overtime,2)?;
        let old_total=old_base+old_bonus+old_overtime-old_fine;
        let n=sqlx::query("UPDATE salaries SET employee_id=?,period_calendar=?,period_year=?,period_month=?,pay_date=?,base_cents=?,bonus_cents=?,fine_cents=?,overtime_cents=?,total_cents=?,payer=?,payment_type=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND employee_id=? AND period_calendar=? AND period_year=? AND period_month=? AND pay_date=? AND base_cents=? AND bonus_cents=? AND fine_cents=? AND overtime_cents=? AND total_cents=? AND payer=? AND payment_type=? AND notes=?")
            .bind(&input.employee_id).bind(&input.period_calendar).bind(input.period_year).bind(input.period_month).bind(&input.pay_date).bind(base).bind(bonus).bind(fine).bind(overtime).bind(total).bind(payer).bind(&input.payment_type).bind(notes).bind(id)
            .bind(expected.employee_id).bind(expected.period_calendar).bind(expected.period_year).bind(expected.period_month).bind(expected.pay_date).bind(old_base).bind(old_bonus).bind(old_fine).bind(old_overtime).bind(old_total).bind(expected.payer).bind(expected.payment_type).bind(expected.notes)
            .execute(db).await.map_err(error)?.rows_affected();
        if n == 0 { return Err("معاش تغییر کرده یا وجود ندارد؛ فرم را ببندید و دوباره باز کنید.".into()); }
    } else {
        if expected.is_some() {return Err("نسخهٔ قبلی برای معاش جدید قابل استفاده نیست.".into());}
        sqlx::query("INSERT INTO salaries(id,employee_id,period_calendar,period_year,period_month,pay_date,base_cents,bonus_cents,fine_cents,overtime_cents,total_cents,payer,payment_type,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(&input.employee_id).bind(&input.period_calendar).bind(input.period_year).bind(input.period_month).bind(&input.pay_date).bind(base).bind(bonus).bind(fine).bind(overtime).bind(total).bind(payer).bind(&input.payment_type).bind(notes).execute(db).await.map_err(error)?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database;
    fn input(employee_id: &str) -> SalaryInput { SalaryInput { employee_id:employee_id.into(), period_calendar:"shamsi".into(), period_year:1404, period_month:1, pay_date:"2025-03-21".into(), base:"۱۰۰.۵۰".into(), bonus:"10.25".into(), fine:"5".into(), overtime:"1".into(), payer:"دخل".into(), payment_type:"cash".into(), notes:"".into() } }
    #[tokio::test]
    async fn stale_concurrent_salary_changes_are_rejected_across_connections() {
        let path=std::env::temp_dir().join(format!("salary-conflict-{}.sqlite3",Uuid::new_v4()));
        let first=open_database(path.clone()).await.unwrap();let second=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')").execute(&first).await.unwrap();
        save(&first,None,input("e"),None).await.unwrap(); let id=list(&first).await.unwrap().remove(0).id;
        let old=input("e");let mut a=input("e");a.notes="اول".into();let mut b=input("e");b.fine="200".into();
        let (x,y)=tokio::join!(save(&first,Some(id.clone()),a,Some(old.clone())),save(&second,Some(id.clone()),b,Some(old.clone())));
        assert_ne!(x.is_ok(),y.is_ok()); let row=list(&first).await.unwrap().remove(0);
        assert!(row.notes=="اول" && row.total=="106.75" || row.notes.is_empty() && row.total=="-88.25");
        assert!(save(&first,Some(id.clone()),input("e"),None).await.is_err());
        assert!(save(&first,Some(id),input("e"),Some(old)).await.is_err());
        first.close().await;second.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn calculate_save_edit_and_preserve_salary_snapshot() {
        let path=std::env::temp_dir().join(format!("salaries-{}.sqlite3", Uuid::new_v4()));
        let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name,base_salary_cents) VALUES('e','E','نام',10050)").execute(&db).await.unwrap();
        save(&db,None,input("e"),None).await.unwrap();
        let row=list(&db).await.unwrap().remove(0); assert_eq!(row.total,"106.75");
        sqlx::query("UPDATE employees SET base_salary_cents=99999 WHERE id='e'").execute(&db).await.unwrap();
        assert_eq!(list(&db).await.unwrap()[0].base,"100.50");
        let mut change=input("e"); change.fine="200".into(); change.payment_type="transfer".into();
        save(&db,Some(row.id),change,Some(input("e"))).await.unwrap(); assert_eq!(list(&db).await.unwrap()[0].total,"-88.25");
        let mut invalid=input("e"); invalid.period_month=13; assert!(save(&db,None,invalid,None).await.is_err());
        assert!(save(&db,None,input("missing"),None).await.is_err());
        assert!(sqlx::query("DELETE FROM employees WHERE id='e'").execute(&db).await.is_err());
        db.close().await; let db=open_database(path.clone()).await.unwrap(); assert_eq!(list(&db).await.unwrap().len(),1);
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
