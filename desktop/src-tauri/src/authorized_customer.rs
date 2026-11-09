//! Transactional authorization prototype. Not exposed as a Tauri command yet.
//! No identity is accepted from the frontend; it comes from the in-process session.
use sqlx::SqlitePool;
use crate::{local_session::{Session, Permission}, service::{self, CustomerInput}};

fn error(e:sqlx::Error)->String {eprintln!("Authorized customer error: {e}");"ثبت مشتری ناموفق بود.".into()}

pub(crate) async fn create(db:&SqlitePool,session:&Session,input:CustomerInput)->Result<String,String> {
    // This write lock serializes role/password revocation and the protected write
    // across independent SQLite connections. An already-authorized operation may
    // complete if the in-process session is logged out while it is in flight.
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let actor=session.authorize_on(&mut tx,Permission::Work).await?;
    let id=service::add_customer_on(&mut tx,input).await?;
    // Link the actor to the exact trigger event without changing existing history.
    // The marker is a separate event and neither contains credentials nor tokens.
    let sequence:Option<i64>=sqlx::query_scalar("SELECT sequence FROM audit_events WHERE entity='customers' AND entity_id=? AND operation='insert' ORDER BY sequence DESC LIMIT 1")
        .bind(&id).fetch_optional(&mut *tx).await.map_err(error)?;
    let sequence=sequence.ok_or("تاریخچهٔ ثبت مشتری موجود نیست؛ عملیات لغو شد.")?;
    sqlx::query("INSERT INTO audit_events(entity,entity_id,operation,actor,after_json) VALUES('authorization',?,'insert',?,json_object('event_sequence',?,'entity','customers','operation','insert'))")
        .bind(&id).bind(&actor.id).bind(sequence).execute(&mut *tx).await.map_err(error)?;
    tx.commit().await.map_err(error)?;Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;use crate::{local_users,service::open_database};use uuid::Uuid;
    fn input(code:&str)->CustomerInput {serde_json::from_str(&format!(r#"{{"code":"{code}","name":"مشتری","phone":"","opening":"0"}}"#)).unwrap()}
    #[tokio::test]
    async fn permission_write_and_actor_marker_commit_together() {
        let path=std::env::temp_dir().join(format!("authorized-customer-{}.sqlite3",Uuid::new_v4()));
        let first=open_database(path.clone()).await.unwrap();let second=open_database(path.clone()).await.unwrap();
        let admin=local_users::bootstrap(&first,"admin","مدیر","admin-password-long").await.unwrap();
        let staff=local_users::create(&first,&admin.id,"staff","کارمند","staff-password-long","staff").await.unwrap();
        let session=Session::default();
        assert!(create(&first,&session,input("X")).await.is_err());
        session.login(&first,"staff","staff-password-long").await.unwrap();
        let id=create(&first,&session,input("X")).await.unwrap();
        let marker:(String,i64)=sqlx::query_as("SELECT actor,json_extract(after_json,'$.event_sequence') FROM audit_events WHERE entity='authorization' AND entity_id=?")
            .bind(&id).fetch_one(&first).await.unwrap();
        assert_eq!(marker.0,staff.id);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events WHERE sequence=? AND entity='customers' AND entity_id=? AND operation='insert'").bind(marker.1).bind(&id).fetch_one(&first).await.unwrap(),1);
        let events:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&first).await.unwrap();
        assert!(create(&first,&session,input("X")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&first).await.unwrap(),events);
        // A failure after the customer trigger but before the marker rolls both back.
        sqlx::query("CREATE TRIGGER reject_test_marker BEFORE INSERT ON audit_events WHEN NEW.entity='authorization' BEGIN SELECT RAISE(ABORT,'test failure'); END").execute(&first).await.unwrap();
        assert!(create(&first,&session,input("ROLLBACK")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM customers WHERE code='ROLLBACK'").fetch_one(&first).await.unwrap(),0);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&first).await.unwrap(),events);
        sqlx::query("DROP TRIGGER reject_test_marker").execute(&first).await.unwrap();
        // While a write transaction is authorized, revocation on another
        // connection cannot commit before that transaction finishes.
        let mut tx=first.begin_with("BEGIN IMMEDIATE").await.unwrap();
        session.authorize_on(&mut tx,Permission::Work).await.unwrap();
        let other=second.clone();let actor_id=admin.id.clone();let staff_id=staff.id.clone();
        let (ready_tx,ready_rx)=tokio::sync::oneshot::channel();
        let revoke=tokio::spawn(async move {let _=ready_tx.send(());local_users::set_access(&other,&actor_id,&staff_id,"staff",false).await});
        ready_rx.await.unwrap();tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        assert!(!revoke.is_finished());tx.commit().await.unwrap();revoke.await.unwrap().unwrap();
        assert!(create(&first,&session,input("Y")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM customers WHERE code='Y'").fetch_one(&first).await.unwrap(),0);
        first.close().await;second.close().await;std::fs::remove_file(path).unwrap();
    }
}
