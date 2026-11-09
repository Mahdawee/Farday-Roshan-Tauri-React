//! Local display preference; it does not set the fiscal year or affect dates stored in SQLite.
use sqlx::SqlitePool;
fn error(err:sqlx::Error)->String { eprintln!("Preference error: {err}"); "خواندن یا ذخیرهٔ تنظیم تقویم ناموفق بود.".into() }
pub(crate) async fn calendar(db:&SqlitePool)->Result<String,String> {
    let value:Option<String>=sqlx::query_scalar("SELECT calendar FROM app_preferences WHERE id=1").fetch_optional(db).await.map_err(error)?;
    match value.as_deref() {Some("shamsi"|"miladi")=>Ok(value.unwrap()),_=>Err("تنظیم تقویم ذخیره‌شده معتبر نیست.".into())}
}
pub(crate) async fn set_calendar(db:&SqlitePool,value:String)->Result<(),String> {
    if !matches!(value.as_str(),"shamsi"|"miladi") {return Err("تقویم انتخاب‌شده معتبر نیست.".into());}
    let changed=sqlx::query("UPDATE app_preferences SET calendar=? WHERE id=1").bind(value).execute(db).await.map_err(error)?.rows_affected();
    if changed!=1 {return Err("تنظیم تقویم پیدا نشد؛ ذخیره انجام نشد.".into());} Ok(())
}
#[cfg(test)] mod tests {
    use super::*;use crate::service::open_database;use uuid::Uuid;
    #[tokio::test] async fn preference_persists_validates_and_does_not_change_other_data() {
        let path=std::env::temp_dir().join(format!("calendar-pref-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        assert_eq!(calendar(&db).await.unwrap(),"shamsi");
        set_calendar(&db,"miladi".into()).await.unwrap();assert!(set_calendar(&db,"bad".into()).await.is_err());
        assert_eq!(calendar(&db).await.unwrap(),"miladi");db.close().await;
        let db=open_database(path.clone()).await.unwrap();assert_eq!(calendar(&db).await.unwrap(),"miladi");
        sqlx::query("DELETE FROM app_preferences").execute(&db).await.unwrap();assert!(calendar(&db).await.is_err());assert!(set_calendar(&db,"shamsi".into()).await.is_err());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
