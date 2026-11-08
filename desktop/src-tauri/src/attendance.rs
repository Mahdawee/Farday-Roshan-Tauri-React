use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize)]
pub(crate) struct AttendanceInput {
    employee_id: String, work_date: String, status: String, check_in: Option<String>, check_out: Option<String>, overtime: String, notes: String,
}
#[derive(Serialize)]
pub(crate) struct Attendance {
    id: String, employee_id: String, employee_name: String, employee_code: String, work_date: String,
    status: String, check_in: Option<String>, check_out: Option<String>, overtime: String, notes: String,
}
fn error(err: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref detail) = err {
        if detail.is_unique_violation() { return "برای این کارمند در این تاریخ قبلاً حضور ثبت شده است؛ رکورد موجود را ویرایش کنید.".into(); }
        if detail.is_foreign_key_violation() { return "کارمند انتخاب‌شده وجود ندارد.".into(); }
    }
    eprintln!("Attendance database error: {err}"); "عملیات حضور و غیاب انجام نشد؛ دوباره تلاش کنید.".into()
}
pub(crate) fn valid_status(status: &str) -> bool { matches!(status, "present" | "absent" | "leave" | "sick" | "holiday" | "friday") }
/// Accept localized digits as input, but store only canonical HH:MM or NULL.
pub(crate) fn parse_time(raw: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = raw else { return Ok(None); };
    let normalized: String = raw.trim().chars().map(|c| match c {
        '۰'..='۹' => char::from_u32('0' as u32 + c as u32 - '۰' as u32).unwrap(),
        '٠'..='٩' => char::from_u32('0' as u32 + c as u32 - '٠' as u32).unwrap(),
        _ => c,
    }).collect();
    if normalized.is_empty() { return Ok(None); }
    let bytes=normalized.as_bytes();
    if bytes.len()!=5 || bytes[2]!=b':' || ![bytes[0],bytes[1],bytes[3],bytes[4]].iter().all(u8::is_ascii_digit)
        || (bytes[0]-b'0')*10+(bytes[1]-b'0') > 23 || (bytes[3]-b'0')*10+(bytes[4]-b'0') > 59 {
        return Err("ساعت معتبر به شکل ۲۴ ساعته، مانند 08:30 وارد کنید.".into());
    }
    Ok(Some(normalized))
}
pub(crate) async fn list(db: &SqlitePool) -> Result<Vec<Attendance>, String> {
    let rows=sqlx::query("SELECT a.*,e.name AS employee_name,e.code AS employee_code FROM attendance a JOIN employees e ON e.id=a.employee_id ORDER BY a.work_date DESC,a.created_at DESC,a.id DESC").fetch_all(db).await.map_err(error)?;
    rows.into_iter().map(|r| Ok(Attendance {
        id:r.try_get("id").map_err(error)?, employee_id:r.try_get("employee_id").map_err(error)?, employee_name:r.try_get("employee_name").map_err(error)?, employee_code:r.try_get("employee_code").map_err(error)?, work_date:r.try_get("work_date").map_err(error)?, status:r.try_get("status").map_err(error)?, check_in:r.try_get("check_in").map_err(error)?, check_out:r.try_get("check_out").map_err(error)?, overtime:money(r.try_get("overtime_hundredths").map_err(error)?), notes:r.try_get("notes").map_err(error)?,
    })).collect()
}
pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: AttendanceInput) -> Result<(), String> {
    valid_date(&input.work_date)?;
    if !valid_status(&input.status) { return Err("وضعیت حضور معتبر نیست.".into()); }
    let check_in=parse_time(input.check_in.as_deref())?; let check_out=parse_time(input.check_out.as_deref())?;
    let overtime=scaled(&input.overtime,2)?;
    if overtime>99999 { return Err("اضافه‌کاری نباید بیشتر از ۹۹۹٫۹۹ ساعت باشد.".into()); }
    let notes=input.notes.trim(); if notes.len()>1020 { return Err("ملاحظات بیش از حد طولانی است.".into()); }
    if let Some(id)=id {
        let changed=sqlx::query("UPDATE attendance SET employee_id=?,work_date=?,status=?,check_in=?,check_out=?,overtime_hundredths=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(&input.employee_id).bind(&input.work_date).bind(&input.status).bind(&check_in).bind(&check_out).bind(overtime).bind(notes).bind(id).execute(db).await.map_err(error)?.rows_affected();
        if changed==0 { return Err("رکورد حضور انتخاب‌شده وجود ندارد.".into()); }
    } else {
        sqlx::query("INSERT INTO attendance(id,employee_id,work_date,status,check_in,check_out,overtime_hundredths,notes) VALUES(?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(&input.employee_id).bind(&input.work_date).bind(&input.status).bind(&check_in).bind(&check_out).bind(overtime).bind(notes).execute(db).await.map_err(error)?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database;
    fn input() -> AttendanceInput { AttendanceInput { employee_id:"e".into(), work_date:"2025-03-21".into(), status:"present".into(), check_in:Some("۰۸:۳۰".into()), check_out:Some("16:30".into()), overtime:"۱.۲۵".into(), notes:"یادداشت".into() } }
    #[tokio::test]
    async fn unique_attendance_validates_times_and_survives_reopen() {
        let path=std::env::temp_dir().join(format!("attendance-{}.sqlite3",Uuid::new_v4())); let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO employees(id,code,name) VALUES('e','E','کارمند')").execute(&db).await.unwrap();
        save(&db,None,input()).await.unwrap(); assert!(save(&db,None,input()).await.is_err());
        let record=list(&db).await.unwrap().remove(0); assert_eq!(record.check_in.as_deref(),Some("08:30")); assert_eq!(record.overtime,"1.25");
        let mut change=input(); change.status="leave".into(); change.check_in=None; save(&db,Some(record.id),change).await.unwrap();
        let mut invalid=input(); invalid.work_date="2025-02-29".into(); assert!(save(&db,None,invalid).await.is_err());
        let mut invalid=input(); invalid.check_in=Some("24:00".into()); assert!(save(&db,None,invalid).await.is_err());
        let mut invalid=input(); invalid.overtime="1000".into(); assert!(save(&db,None,invalid).await.is_err());
        let mut invalid=input(); invalid.employee_id="missing".into(); assert!(save(&db,None,invalid).await.is_err());
        assert!(save(&db,Some("missing".into()),input()).await.is_err());
        assert!(sqlx::query("DELETE FROM employees WHERE id='e'").execute(&db).await.is_err());
        db.close().await; let db=open_database(path.clone()).await.unwrap(); let row=list(&db).await.unwrap().remove(0); assert_eq!(row.status,"leave"); assert_eq!(row.check_in,None);
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
