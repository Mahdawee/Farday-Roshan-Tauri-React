//! Session prototype, not exposed to the webview or Tauri commands.
//! Authorization must ultimately be checked in the same transaction as each
//! protected operation; this prototype alone is not an access-control boundary.
use std::{sync::Mutex, time::{Duration, Instant}};
use sqlx::{Row, SqlitePool};
use crate::local_users::{self, User};

const IDLE:Duration=Duration::from_secs(30*60);
#[derive(Clone,Copy)]
pub(crate) enum Permission { Work, Admin }
struct Active { id:String, revision:i64, last_used:Instant, epoch:u64 }
#[derive(Default)]
struct Inner { active:Option<Active>, epoch:u64 }
#[derive(Default)]
pub(crate) struct Session { inner:Mutex<Inner> }
fn locked()->String {"نشست کاربر قابل بررسی نیست.".into()}
const LOGIN_REQUIRED:&str="نشست منقضی شده یا معتبر نیست؛ دوباره وارد شوید.";

impl Session {
    pub(crate) async fn login(&self,db:&SqlitePool,login:&str,password:&str)->Result<User,String> {
        // A later login/logout invalidates an in-flight login attempt.
        let epoch={let mut inner=self.inner.lock().map_err(|_|locked())?;inner.epoch=inner.epoch.wrapping_add(1);inner.active=None;inner.epoch};
        let user=local_users::authenticate(db,login,password).await?;
        let mut inner=self.inner.lock().map_err(|_|locked())?;
        if inner.epoch!=epoch {return Err(LOGIN_REQUIRED.into());}
        inner.active=Some(Active{id:user.id.clone(),revision:user.auth_revision,last_used:Instant::now(),epoch});
        Ok(user)
    }
    pub(crate) fn logout(&self)->Result<(),String> {
        let mut inner=self.inner.lock().map_err(|_|locked())?;inner.epoch=inner.epoch.wrapping_add(1);inner.active=None;Ok(())
    }
    pub(crate) async fn authorize(&self,db:&SqlitePool,permission:Permission)->Result<User,String> {
        let (id,revision,epoch)={
            let mut inner=self.inner.lock().map_err(|_|locked())?;
            if inner.active.as_ref().is_some_and(|a|a.last_used.elapsed()>=IDLE) {inner.active=None;}
            let active=inner.active.as_ref().ok_or(LOGIN_REQUIRED)?;
            (active.id.clone(),active.revision,active.epoch)
        };
        let row=sqlx::query("SELECT id,username,full_name,role,active,auth_revision FROM local_users WHERE id=? AND active=1 AND auth_revision=?")
            .bind(&id).bind(revision).fetch_optional(db).await.map_err(|e|{eprintln!("Session database error: {e}");"بررسی نشست ناموفق بود.".to_string()})?;
        let mut inner=self.inner.lock().map_err(|_|locked())?;
        // Do not revive a session that expired or was logged out while awaiting SQLite.
        let matching=inner.active.as_ref().is_some_and(|a|a.epoch==epoch && a.id==id && a.revision==revision && a.last_used.elapsed()<IDLE);
        if !matching {return Err(LOGIN_REQUIRED.into());}
        let Some(row)=row else {inner.active=None;return Err(LOGIN_REQUIRED.into());};
        let role:String=row.try_get("role").map_err(|_|"بررسی نشست ناموفق بود.")?;
        if matches!(permission,Permission::Admin) && role!="admin" {return Err("این عملیات فقط برای مدیر مجاز است.".into());}
        inner.active.as_mut().ok_or(LOGIN_REQUIRED)?.last_used=Instant::now();
        Ok(User {id:row.try_get("id").map_err(|_|"بررسی نشست ناموفق بود.")?,username:row.try_get("username").map_err(|_|"بررسی نشست ناموفق بود.")?,full_name:row.try_get("full_name").map_err(|_|"بررسی نشست ناموفق بود.")?,role,active:row.try_get("active").map_err(|_|"بررسی نشست ناموفق بود.")?,auth_revision:row.try_get("auth_revision").map_err(|_|"بررسی نشست ناموفق بود.")?})
    }
}
#[cfg(test)]
mod tests {
    use super::*;use crate::service::open_database;use uuid::Uuid;
    #[tokio::test]
    async fn sessions_check_role_revision_expiry_and_logout() {
        let path=std::env::temp_dir().join(format!("session-{}.sqlite3",Uuid::new_v4()));let db=open_database(path.clone()).await.unwrap();
        let admin=local_users::bootstrap(&db,"admin","مدیر","admin-password-long").await.unwrap();
        let staff=local_users::create(&db,&admin.id,"staff","کارمند","staff-password-long","staff").await.unwrap();
        let session=Session::default();
        assert!(session.authorize(&db,Permission::Work).await.is_err());
        session.login(&db,"staff","staff-password-long").await.unwrap();
        assert!(session.authorize(&db,Permission::Work).await.is_ok()); assert!(session.authorize(&db,Permission::Admin).await.is_err());
        local_users::set_access(&db,&admin.id,&staff.id,"admin",true).await.unwrap();
        assert!(session.authorize(&db,Permission::Work).await.is_err());
        session.login(&db,"staff","staff-password-long").await.unwrap();assert!(session.authorize(&db,Permission::Admin).await.is_ok());
        local_users::reset_password(&db,&admin.id,&staff.id,"new-staff-password").await.unwrap();
        assert!(session.authorize(&db,Permission::Work).await.is_err());
        session.login(&db,"staff","new-staff-password").await.unwrap();
        { let mut inner=session.inner.lock().unwrap();inner.active.as_mut().unwrap().last_used=Instant::now()-IDLE; }
        assert!(session.authorize(&db,Permission::Work).await.is_err());
        session.login(&db,"admin","admin-password-long").await.unwrap();session.logout().unwrap();assert!(session.authorize(&db,Permission::Admin).await.is_err());
        db.close().await;std::fs::remove_file(path).unwrap();
    }
}
