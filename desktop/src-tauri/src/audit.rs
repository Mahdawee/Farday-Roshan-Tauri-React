//! Experimental local history, not authenticated or tamper-proof.
use serde::Serialize;
use sqlx::{Row, SqlitePool};

const PAGE_SIZE: i64 = 50;
#[derive(Serialize)]
pub(crate) struct AuditEntry {
    sequence: String, occurred_utc: String, entity: String, entity_id: String,
    operation: String, actor: Option<String>, before_json: Option<String>, after_json: Option<String>,
}
#[derive(Serialize)]
pub(crate) struct AuditPage { rows: Vec<AuditEntry>, page:i64, total:i64, page_size:i64 }
fn error(e:sqlx::Error)->String { eprintln!("Audit query error: {e}"); "خواندن تاریخچهٔ تغییرات ناموفق بود.".into() }

pub(crate) async fn list(db:&SqlitePool, page:i64)->Result<AuditPage,String> {
    if !(0..=1_000_000).contains(&page) {return Err("صفحه معتبر نیست.".into());}
    let mut tx=db.begin().await.map_err(error)?;
    let total:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&mut *tx).await.map_err(error)?;
    let rows=sqlx::query("SELECT a.sequence,a.occurred_utc,a.entity,a.entity_id,a.operation,COALESCE(a.actor,(SELECT m.actor FROM audit_events m WHERE m.entity='authorization' AND m.entity_id=a.entity_id AND m.actor IS NOT NULL AND json_extract(m.after_json,'$.event_sequence')=a.sequence AND json_extract(m.after_json,'$.entity')=a.entity AND json_extract(m.after_json,'$.operation')=a.operation ORDER BY m.sequence DESC LIMIT 1)) AS actor,a.before_json,a.after_json FROM audit_events a ORDER BY a.sequence DESC LIMIT ? OFFSET ?")
        .bind(PAGE_SIZE).bind(page*PAGE_SIZE).fetch_all(&mut *tx).await.map_err(error)?;
    let rows=rows.into_iter().map(|r| Ok(AuditEntry {
        sequence:r.try_get::<i64,_>("sequence").map_err(error)?.to_string(), occurred_utc:r.try_get("occurred_utc").map_err(error)?,
        entity:r.try_get("entity").map_err(error)?,entity_id:r.try_get("entity_id").map_err(error)?,operation:r.try_get("operation").map_err(error)?,
        actor:r.try_get("actor").map_err(error)?,before_json:r.try_get("before_json").map_err(error)?,after_json:r.try_get("after_json").map_err(error)?,
    })).collect::<Result<Vec<_>,String>>()?;
    tx.commit().await.map_err(error)?;
    Ok(AuditPage{rows,page,total,page_size:PAGE_SIZE})
}

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database; use uuid::Uuid;
    #[tokio::test]
    async fn resolves_actor_only_from_a_matching_authorization_marker() {
        use crate::{authorized_customer, local_session::Session, local_users, service::CustomerInput};
        let path=std::env::temp_dir().join(format!("audit-actor-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        let admin=local_users::bootstrap(&db,"admin","مدیر","admin-password-long").await.unwrap();
        let session=Session::default();session.login(&db,"admin","admin-password-long").await.unwrap();
        let input:CustomerInput=serde_json::from_str(r#"{"code":"C","name":"مشتری","phone":"","opening":"0"}"#).unwrap();
        let id=authorized_customer::create(&db,&session,input).await.unwrap();
        let rows=list(&db,0).await.unwrap().rows;
        let customer=rows.iter().find(|r|r.entity=="customers" && r.entity_id==id).unwrap();
        assert_eq!(customer.actor.as_deref(),Some(admin.id.as_str()));
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('other','D','دیگر')").execute(&db).await.unwrap();
        let rows=list(&db,0).await.unwrap().rows;
        assert_eq!(rows.iter().find(|r|r.entity=="customers" && r.entity_id=="other").unwrap().actor,None);
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn captures_values_and_rolls_back_with_business_changes() {
        let path=std::env::temp_dir().join(format!("audit-{}.sqlite3",Uuid::new_v4()));
        let db=open_database(path.clone()).await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','اول')").execute(&db).await.unwrap();
        sqlx::query("UPDATE customers SET name='دوم',opening_cents=2500 WHERE id='c'").execute(&db).await.unwrap();
        let page=list(&db,0).await.unwrap(); assert_eq!(page.total,2);
        assert_eq!(page.rows[0].operation,"update"); assert_eq!(page.rows[0].actor,None);
        assert!(page.rows[0].before_json.as_ref().unwrap().contains("اول")); assert!(page.rows[0].after_json.as_ref().unwrap().contains("دوم"));
        let mut tx=db.begin().await.unwrap();
        sqlx::query("UPDATE customers SET name='لغو' WHERE id='c'").execute(&mut *tx).await.unwrap(); tx.rollback().await.unwrap();
        assert_eq!(list(&db,0).await.unwrap().total,2);
        assert!(sqlx::query("DELETE FROM audit_events").execute(&db).await.is_err());
        assert!(sqlx::query("UPDATE audit_events SET actor='x'").execute(&db).await.is_err());
        assert!(list(&db,-1).await.is_err());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
