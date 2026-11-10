//! Internal session-authorized account management. Not exposed to Tauri yet.
use sqlx::SqlitePool;
use crate::{local_users::{self,User},local_session::{Session,Permission}};
fn error(e:sqlx::Error)->String {eprintln!("Authorized account operation error: {e}");"عملیات کاربران ناموفق بود.".into()}

pub(crate) async fn create(db:&SqlitePool,session:&Session,login:&str,name:&str,password:&str,role:&str)->Result<User,String> {
    // Compute the hash outside the write lock, but recheck authorization after it.
    let hash=local_users::hash_password(password)?;
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let actor=session.authorize_on(&mut tx,Permission::Admin).await?;
    let user=local_users::create_on(&mut tx,&actor.id,login,name,&hash,role).await?;
    tx.commit().await.map_err(error)?;Ok(user)
}
pub(crate) async fn set_access(db:&SqlitePool,session:&Session,id:&str,role:&str,active:bool)->Result<(),String> {
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let actor=session.authorize_on(&mut tx,Permission::Admin).await?;
    local_users::set_access_on(&mut tx,&actor.id,id,role,active).await?;
    tx.commit().await.map_err(error)
}
pub(crate) async fn reset_password(db:&SqlitePool,session:&Session,id:&str,password:&str)->Result<(),String> {
    let hash=local_users::hash_password(password)?;
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let actor=session.authorize_on(&mut tx,Permission::Admin).await?;
    local_users::reset_password_on(&mut tx,&actor.id,id,&hash).await?;
    tx.commit().await.map_err(error)
}

/// Change only the current session's own password. Password verification and
/// hashing are deliberately outside the lock; the session is checked again
/// inside the write transaction, and the verified hash/revision use CAS.
pub(crate) async fn change_password(db:&SqlitePool,session:&Session,current:&str,new_password:&str)->Result<(),String> {
    let (initial,epoch)=session.authorize_lease(db,Permission::Work).await?;
    let prepared=local_users::prepare_password_change(db,&initial.id,current,new_password).await?;
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(error)?;
    let actor=session.authorize_on(&mut tx,Permission::Work).await?;
    if actor.id!=initial.id || actor.auth_revision!=initial.auth_revision {return Err("نشست تغییر کرده است؛ دوباره وارد شوید.".into());}
    session.check_lease(epoch)?;
    local_users::change_password_on(&mut tx,&actor.id,prepared).await?;
    tx.commit().await.map_err(error)
}

#[cfg(test)]
mod tests {
    use super::*;use crate::service::open_database;use uuid::Uuid;
    #[tokio::test]
    async fn prepared_password_change_cannot_override_a_concurrent_reset() {
        let path=std::env::temp_dir().join(format!("authorized-password-race-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        let root=local_users::bootstrap(&db,"root","مدیر","root-password-long").await.unwrap();
        let prepared=local_users::prepare_password_change(&db,&root.id,"root-password-long","later-password-long").await.unwrap();
        local_users::reset_password(&db,&root.id,&root.id,"reset-password-long").await.unwrap();
        let mut tx=db.begin_with("BEGIN IMMEDIATE").await.unwrap();
        assert!(local_users::change_password_on(&mut tx,&root.id,prepared).await.is_err());tx.rollback().await.unwrap();
        assert!(local_users::authenticate(&db,"root","later-password-long").await.is_err());
        assert!(local_users::authenticate(&db,"root","reset-password-long").await.is_ok());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn own_password_change_is_session_bound_and_invalidates_session() {
        let path=std::env::temp_dir().join(format!("authorized-password-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        local_users::bootstrap(&db,"root","مدیر","root-password-long").await.unwrap();
        let session=Session::default();
        assert!(change_password(&db,&session,"root-password-long","new-password-long").await.is_err());
        session.login(&db,"root","root-password-long").await.unwrap();
        assert!(change_password(&db,&session,"wrong-password","new-password-long").await.is_err());
        change_password(&db,&session,"root-password-long","new-password-long").await.unwrap();
        assert!(session.authorize(&db,Permission::Work).await.is_err());
        assert!(session.login(&db,"root","root-password-long").await.is_err());
        session.login(&db,"root","new-password-long").await.unwrap();
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn only_current_admin_can_manage_users_and_all_changes_are_attributed() {
        let path=std::env::temp_dir().join(format!("authorized-users-{}.sqlite3",Uuid::new_v4()));
        let db=open_database(path.clone()).await.unwrap();
        let root=local_users::bootstrap(&db,"root","مدیر","root-password-long").await.unwrap();
        let session=Session::default();
        assert!(create(&db,&session,"staff","کارمند","staff-password-long","staff").await.is_err());
        session.login(&db,"root","root-password-long").await.unwrap();
        let staff=create(&db,&session,"staff","کارمند","staff-password-long","staff").await.unwrap();
        let second=create(&db,&session,"other","مدیر دوم","other-password-long","admin").await.unwrap();
        let staff_session=Session::default();staff_session.login(&db,"staff","staff-password-long").await.unwrap();
        assert!(set_access(&db,&staff_session,&staff.id,"admin",true).await.is_err());
        assert!(reset_password(&db,&staff_session,&root.id,"invalid-password-long").await.is_err());
        reset_password(&db,&session,&staff.id,"reset-password-long").await.unwrap();
        assert!(staff_session.authorize(&db,Permission::Work).await.is_err());
        set_access(&db,&session,&second.id,"admin",false).await.unwrap();
        assert!(set_access(&db,&session,&root.id,"staff",true).await.is_err());
        let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events WHERE entity='local_users' AND actor=? AND entity_id<>?").bind(&root.id).bind(&root.id).fetch_one(&db).await.unwrap();assert_eq!(count,4);
        let leaks:i64=sqlx::query_scalar("SELECT COUNT(*) FROM audit_events WHERE entity='local_users' AND (COALESCE(before_json,'') LIKE '%password%' OR COALESCE(after_json,'') LIKE '%password%' OR COALESCE(after_json,'') LIKE '%argon2%')").fetch_one(&db).await.unwrap();assert_eq!(leaks,0);
        // An admin's session revision must be rechecked after a reset.
        let other=Session::default();set_access(&db,&session,&second.id,"admin",true).await.unwrap();
        other.login(&db,"other","other-password-long").await.unwrap();
        reset_password(&db,&session,&second.id,"changed-password-long").await.unwrap();
        assert!(create(&db,&other,"third","دیگر","third-password-long","staff").await.is_err());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
