//! Internal transactional authorization for customer and sales/receipt writes.
//! Deliberately not exposed until all command paths are protected.
use sqlx::{Sqlite, SqlitePool, Transaction};
use crate::{local_session::{Permission,Session},service::{self,CustomerInput,SaleInput,ReceiptInput}};

fn error(e:sqlx::Error)->String {eprintln!("Authorized transaction error: {e}");"ثبت مجاز و تاریخچه ناموفق بود.".into()}
struct Write<'a> { tx:Transaction<'a,Sqlite>, actor:String, first_sequence:i64 }
impl<'a> Write<'a> {
    async fn begin(db:&'a SqlitePool,session:&Session)->Result<Self,String> {
        // This lock serializes authorization, writes and attribution against
        // revocations from other connections. A logout after authorization does
        // not cancel an operation already in progress.
        let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
        let actor=session.authorize_on(&mut tx,Permission::Work).await?.id;
        let first_sequence=sqlx::query_scalar("SELECT COALESCE(MAX(sequence),0) FROM audit_events").fetch_one(&mut *tx).await.map_err(error)?;
        Ok(Self{tx,actor,first_sequence})
    }
    async fn commit(mut self,entity:&str,id:&str,operation:&str)->Result<(),String> {
        // Refuse to commit if the required primary audit trigger didn't fire.
        let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events WHERE sequence>? AND entity=? AND entity_id=? AND operation=?")
            .bind(self.first_sequence).bind(entity).bind(id).bind(operation).fetch_one(&mut *self.tx).await.map_err(error)?;
        if count!=1 {return Err("تاریخچهٔ اصلی عملیات موجود نیست؛ عملیات لغو شد.".into());}
        // Insert one marker for every trigger event in this transaction. Do not
        // trust IDs or actor names supplied by the frontend. The SQLite write
        // lock prevents events from another connection entering this range.
        sqlx::query("INSERT INTO audit_events(entity,entity_id,operation,actor,after_json) SELECT 'authorization',entity_id,'insert',?,json_object('event_sequence',sequence,'entity',entity,'operation',operation) FROM audit_events WHERE sequence>? AND entity<>'authorization'")
            .bind(&self.actor).bind(self.first_sequence).execute(&mut *self.tx).await.map_err(error)?;
        self.tx.commit().await.map_err(error)
    }
}
pub(crate) async fn update_customer(db:&SqlitePool,session:&Session,id:String,input:CustomerInput,expected:CustomerInput)->Result<(),String> {
    let mut w=Write::begin(db,session).await?;
    service::update_customer_on(&mut w.tx,id.clone(),input,expected).await?;
    w.commit("customers",&id,"update").await
}
pub(crate) async fn add_sale(db:&SqlitePool,session:&Session,input:SaleInput)->Result<String,String> {
    let mut w=Write::begin(db,session).await?;
    let id=service::add_sale_on(&mut w.tx,input).await?;
    w.commit("sales",&id,"insert").await?;Ok(id)
}
pub(crate) async fn update_sale(db:&SqlitePool,session:&Session,id:String,input:SaleInput,expected:SaleInput)->Result<(),String> {
    let mut w=Write::begin(db,session).await?;
    service::update_sale_on(&mut w.tx,id.clone(),input,expected).await?;
    w.commit("sales",&id,"update").await
}
pub(crate) async fn add_receipt(db:&SqlitePool,session:&Session,input:ReceiptInput)->Result<String,String> {
    let mut w=Write::begin(db,session).await?;
    let id=service::add_receipt_on(&mut w.tx,input).await?;
    w.commit("receipts",&id,"insert").await?;Ok(id)
}
pub(crate) async fn update_receipt(db:&SqlitePool,session:&Session,id:String,input:ReceiptInput,expected:ReceiptInput)->Result<(),String> {
    let mut w=Write::begin(db,session).await?;
    service::update_receipt_on(&mut w.tx,id.clone(),input,expected).await?;
    w.commit("receipts",&id,"update").await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{local_users,service::open_database};
    use uuid::Uuid;
    fn customer(name:&str)->CustomerInput {serde_json::from_str(&format!(r#"{{"code":"C","name":"{name}","phone":"","opening":"0"}}"#)).unwrap()}
    fn sale(customer:&str,volume:&str)->SaleInput {serde_json::from_str(&format!(r#"{{"customer_id":"{customer}","date":"2025-03-21","material":"ریگ","volume":"{volume}","unit_price":"5","freight":"0","payment_type":"credit"}}"#)).unwrap()}
    fn receipt(customer:&str,amount:&str)->ReceiptInput {serde_json::from_str(&format!(r#"{{"customer_id":"{customer}","date":"2025-03-21","amount":"{amount}","source":"debt"}}"#)).unwrap()}
    #[tokio::test]
    async fn protected_changes_record_every_trigger_event_and_reject_stale_or_missing_session() {
        let path=std::env::temp_dir().join(format!("authorized-transactions-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        let admin=local_users::bootstrap(&db,"admin","مدیر","admin-password-long").await.unwrap();
        let session=Session::default();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','اول')").execute(&db).await.unwrap();
        assert!(update_customer(&db,&session,"c".into(),customer("دوم"),customer("اول")).await.is_err());
        session.login(&db,"admin","admin-password-long").await.unwrap();
        update_customer(&db,&session,"c".into(),customer("دوم"),customer("اول")).await.unwrap();
        assert!(update_customer(&db,&session,"c".into(),customer("سوم"),customer("اول")).await.is_err());
        let s=add_sale(&db,&session,sale("c","1")).await.unwrap();
        update_sale(&db,&session,s.clone(),sale("c","2"),sale("c","1")).await.unwrap();
        assert!(update_sale(&db,&session,s.clone(),sale("c","3"),sale("c","1")).await.is_err());
        let r=add_receipt(&db,&session,receipt("c","2")).await.unwrap();
        update_receipt(&db,&session,r.clone(),receipt("c","3"),receipt("c","2")).await.unwrap();
        assert!(update_receipt(&db,&session,r,receipt("c","4"),receipt("c","2")).await.is_err());
        // Every new business event, including detail/number rows, has exactly
        // one matching marker carrying the session actor. The initial direct
        // customer insert predates these operations and remains unattributed.
        let missing:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events a WHERE a.sequence>1 AND a.entity<>'authorization' AND (SELECT COUNT(*) FROM audit_events m WHERE m.entity='authorization' AND m.actor=? AND json_extract(m.after_json,'$.event_sequence')=a.sequence AND m.entity_id=a.entity_id AND json_extract(m.after_json,'$.entity')=a.entity AND json_extract(m.after_json,'$.operation')=a.operation)<>1")
            .bind(&admin.id).fetch_one(&db).await.unwrap();
        // Bootstrap and direct insert predate the first protected change.
        // Filter the baseline below rather than claiming attribution for them.
        assert!(missing>=1);
        let missing:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events a WHERE a.sequence>(SELECT sequence FROM audit_events WHERE entity='customers' AND entity_id='c' AND operation='insert') AND a.entity<>'authorization' AND (SELECT COUNT(*) FROM audit_events m WHERE m.entity='authorization' AND m.actor=? AND json_extract(m.after_json,'$.event_sequence')=a.sequence AND m.entity_id=a.entity_id AND json_extract(m.after_json,'$.entity')=a.entity AND json_extract(m.after_json,'$.operation')=a.operation)<>1")
            .bind(&admin.id).fetch_one(&db).await.unwrap();assert_eq!(missing,0);
        session.logout().unwrap();assert!(add_sale(&db,&session,sale("c","1")).await.is_err());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn missing_trigger_or_failed_marker_rolls_back_all_rows_and_numbers() {
        let path=std::env::temp_dir().join(format!("authorized-rollback-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        local_users::bootstrap(&db,"admin","مدیر","admin-password-long").await.unwrap();let session=Session::default();session.login(&db,"admin","admin-password-long").await.unwrap();
        sqlx::query("INSERT INTO customers(id,code,name) VALUES('c','C','اول')").execute(&db).await.unwrap();
        let baseline:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events").fetch_one(&db).await.unwrap();
        sqlx::query("CREATE TRIGGER reject_test_marker BEFORE INSERT ON audit_events WHEN NEW.entity='authorization' BEGIN SELECT RAISE(ABORT,'test'); END").execute(&db).await.unwrap();
        assert!(add_sale(&db,&session,sale("c","1")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM sales").fetch_one(&db).await.unwrap(),0);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM sale_numbers").fetch_one(&db).await.unwrap(),0);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&db).await.unwrap(),baseline);
        sqlx::query("DROP TRIGGER reject_test_marker").execute(&db).await.unwrap();
        sqlx::query("DROP TRIGGER audit_receipts_insert").execute(&db).await.unwrap();
        assert!(add_receipt(&db,&session,receipt("c","1")).await.is_err());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM receipts").fetch_one(&db).await.unwrap(),0);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM receipt_numbers").fetch_one(&db).await.unwrap(),0);
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM audit_events").fetch_one(&db).await.unwrap(),baseline);
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
