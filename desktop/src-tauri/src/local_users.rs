//! Account-storage foundation only. Not connected to Tauri commands or sessions.
//! Callers must eventually establish the actor from an authenticated session;
//! taking an actor ID from the frontend would be insecure.
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use serde::Serialize;
use sqlx::{Row, SqliteConnection, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub(crate) struct User {
    pub(crate) id:String, pub(crate) username:String, pub(crate) full_name:String,
    pub(crate) role:String, pub(crate) active:bool, pub(crate) auth_revision:i64,
}
fn db_error(e:sqlx::Error)->String {
    if let sqlx::Error::Database(ref d)=e { if d.is_unique_violation() { return "نام کاربری قبلاً ثبت شده است.".into(); } }
    eprintln!("Local user database error: {e}"); "عملیات کاربران ناموفق بود.".into()
}
fn username(raw:&str)->Result<String,String> {
    let name=raw.trim();
    if !(3..=40).contains(&name.len()) || !name.bytes().all(|b|b.is_ascii_alphanumeric() || matches!(b,b'_'|b'-'|b'.')) {
        return Err("نام کاربری باید ۳ تا ۴۰ حرف لاتین، عدد، نقطه، خط یا زیرخط باشد.".into());
    }
    Ok(name.to_ascii_lowercase())
}
fn full_name(raw:&str)->Result<String,String> {
    let name=raw.trim(); if name.is_empty() || name.len()>320 { return Err("نام کامل معتبر وارد کنید.".into()); } Ok(name.into())
}
fn hash_password(password:&str)->Result<String,String> {
    if password.chars().count()<12 || password.len()>1024 { return Err("رمز باید حداقل ۱۲ حرف و حداکثر ۱۰۲۴ بایت باشد.".into()); }
    let salt=SaltString::encode_b64(Uuid::new_v4().as_bytes()).map_err(|_|"ساخت رمز ناموفق بود.")?;
    Ok(Argon2::default().hash_password(password.as_bytes(),&salt).map_err(|_|"ساخت رمز ناموفق بود.")?.to_string())
}
fn verify_password(password:&str, hash:&str)->bool {
    if password.len()>1024 { return false; }
    PasswordHash::new(hash).ok().is_some_and(|parsed|Argon2::default().verify_password(password.as_bytes(),&parsed).is_ok())
}
fn user(row:&sqlx::sqlite::SqliteRow)->Result<User,String> {
    Ok(User{id:row.try_get("id").map_err(db_error)?,username:row.try_get("username").map_err(db_error)?,full_name:row.try_get("full_name").map_err(db_error)?,role:row.try_get("role").map_err(db_error)?,active:row.try_get("active").map_err(db_error)?,auth_revision:row.try_get("auth_revision").map_err(db_error)?})
}
async fn require_admin(tx:&mut SqliteConnection,actor_id:&str)->Result<(),String> {
    let active:Option<i64>=sqlx::query_scalar("SELECT 1 FROM local_users WHERE id=? AND active=1 AND role='admin'").bind(actor_id).fetch_optional(tx).await.map_err(db_error)?;
    if active.is_none() {return Err("فقط مدیر فعال می‌تواند کاربران را مدیریت کند.".into());} Ok(())
}
async fn record_user(tx:&mut SqliteConnection,actor:&str,id:&str,operation:&str,before:Option<&str>,after:&str)->Result<(),String> {
    // No hashes or passwords in journal snapshots.
    sqlx::query("INSERT INTO audit_events(entity,entity_id,operation,actor,before_json,after_json) VALUES('local_users',?,?,?,?,?)")
        .bind(id).bind(operation).bind(actor).bind(before).bind(after).execute(tx).await.map_err(db_error)?; Ok(())
}
fn public_json(u:&User)->Result<String,String> {
    serde_json::to_string(u).map_err(|_|"ثبت تاریخچهٔ کاربران ناموفق بود.".into())
}
/// Exactly one bootstrap can win even across connections. No default credentials.
pub(crate) async fn bootstrap(db:&SqlitePool,login:&str,name:&str,password:&str)->Result<User,String> {
    let login=username(login)?; let name=full_name(name)?; let hash=hash_password(password)?;
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(db_error)?;
    let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM local_users").fetch_one(&mut *tx).await.map_err(db_error)?;
    if count!=0 {return Err("مدیر اولیه قبلاً ایجاد شده است.".into());}
    let u=User{id:Uuid::new_v4().to_string(),username:login,full_name:name,role:"admin".into(),active:true,auth_revision:1};
    sqlx::query("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES(?,?,?,?,?)")
        .bind(&u.id).bind(&u.username).bind(&u.full_name).bind(hash).bind(&u.role).execute(&mut *tx).await.map_err(db_error)?;
    record_user(&mut tx,&u.id,&u.id,"insert",None,&public_json(&u)?).await?;
    tx.commit().await.map_err(db_error)?; Ok(u)
}
/// Authentication foundation only; session establishment and throttling are not yet implemented.
pub(crate) async fn authenticate(db:&SqlitePool,login:&str,password:&str)->Result<User,String> {
    let invalid="نام کاربری یا رمز عبور نادرست است.";
    let login=username(login).map_err(|_|invalid.to_string())?;
    let row=sqlx::query("SELECT id,username,full_name,role,active,auth_revision,password_hash FROM local_users WHERE username=?")
        .bind(login).fetch_optional(db).await.map_err(db_error)?;
    let row=row.ok_or(invalid)?;
    let hash:String=row.try_get("password_hash").map_err(db_error)?;
    if !row.try_get::<bool,_>("active").map_err(db_error)? || !verify_password(password,&hash) {return Err(invalid.into());}
    user(&row)
}
pub(crate) async fn create(db:&SqlitePool,actor_id:&str,login:&str,name:&str,password:&str,role:&str)->Result<User,String> {
    let login=username(login)?; let name=full_name(name)?;
    if !matches!(role,"admin"|"staff") {return Err("نقش معتبر نیست.".into());}
    let hash=hash_password(password)?;
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(db_error)?; require_admin(&mut tx,actor_id).await?;
    let u=User{id:Uuid::new_v4().to_string(),username:login,full_name:name,role:role.into(),active:true,auth_revision:1};
    sqlx::query("INSERT INTO local_users(id,username,full_name,password_hash,role) VALUES(?,?,?,?,?)")
        .bind(&u.id).bind(&u.username).bind(&u.full_name).bind(hash).bind(&u.role).execute(&mut *tx).await.map_err(db_error)?;
    record_user(&mut tx,actor_id,&u.id,"insert",None,&public_json(&u)?).await?;
    tx.commit().await.map_err(db_error)?; Ok(u)
}
/// Restrict deactivation/demotion so there is always at least one active admin.
pub(crate) async fn set_access(db:&SqlitePool,actor_id:&str,id:&str,role:&str,active:bool)->Result<(),String> {
    if !matches!(role,"admin"|"staff") {return Err("نقش معتبر نیست.".into());}
    let mut tx=db.begin_with("BEGIN IMMEDIATE").await.map_err(db_error)?; require_admin(&mut tx,actor_id).await?;
    let row=sqlx::query("SELECT id,username,full_name,role,active,auth_revision FROM local_users WHERE id=?").bind(id).fetch_optional(&mut *tx).await.map_err(db_error)?.ok_or("کاربر وجود ندارد.")?;
    let old=user(&row)?;
    if old.role=="admin" && old.active && (role!="admin" || !active) {
        let count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM local_users WHERE role='admin' AND active=1").fetch_one(&mut *tx).await.map_err(db_error)?;
        if count<=1 {return Err("حداقل یک مدیر فعال باید باقی بماند.".into());}
    }
    let changed=sqlx::query("UPDATE local_users SET role=?,active=?,auth_revision=auth_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(role).bind(active).bind(id).execute(&mut *tx).await.map_err(db_error)?.rows_affected();
    if changed!=1 {return Err("کاربر وجود ندارد.".into());}
    let mut new=old.clone();new.role=role.into();new.active=active;new.auth_revision+=1;
    record_user(&mut tx,actor_id,id,"update",Some(&public_json(&old)?),&public_json(&new)?).await?;
    tx.commit().await.map_err(db_error)?; Ok(())
}

#[cfg(test)]
mod tests {
    use super::*; use crate::service::open_database;
    #[tokio::test]
    async fn bootstrap_credentials_roles_and_last_admin() {
        let path=std::env::temp_dir().join(format!("local-users-{}.sqlite3",Uuid::new_v4()));
        let db=open_database(path.clone()).await.unwrap();
        assert!(bootstrap(&db,"bad username","مدیر","short").await.is_err());
        assert!(bootstrap(&db,"admin","مدیر","short").await.is_err());
        let admin=bootstrap(&db,"Admin","مدیر","long secure password").await.unwrap();
        assert_eq!(admin.username,"admin");
        assert!(bootstrap(&db,"other","دیگر","long secure password").await.is_err());
        assert!(authenticate(&db,"admin","wrong password").await.is_err());
        assert_eq!(authenticate(&db,"ADMIN","long secure password").await.unwrap().id,admin.id);
        let staff=create(&db,&admin.id,"Staff","کارمند","another secure password","staff").await.unwrap();
        assert!(create(&db,&staff.id,"third","دیگر","another secure password","staff").await.is_err());
        assert!(create(&db,&admin.id,"STAFF","تکراری","another secure password","staff").await.is_err());
        assert!(set_access(&db,&admin.id,&admin.id,"staff",true).await.is_err());
        assert!(set_access(&db,&admin.id,&admin.id,"admin",false).await.is_err());
        set_access(&db,&admin.id,&staff.id,"staff",false).await.unwrap();
        assert!(authenticate(&db,"staff","another secure password").await.is_err());
        let hash:String=sqlx::query_scalar("SELECT password_hash FROM local_users WHERE id=?").bind(&admin.id).fetch_one(&db).await.unwrap();
        assert!(hash.starts_with("$argon2id$")); assert!(!hash.contains("long secure password"));
        let events:Vec<String>=sqlx::query_scalar("SELECT COALESCE(before_json,'') || COALESCE(after_json,'') FROM audit_events WHERE entity='local_users'").fetch_all(&db).await.unwrap();
        assert_eq!(events.len(),3); assert!(events.iter().all(|s|!s.contains("password") && !s.contains("argon2")));
        db.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn bootstrap_and_last_admin_are_atomic_across_connections() {
        let path=std::env::temp_dir().join(format!("users-race-{}.sqlite3",Uuid::new_v4()));
        let a=open_database(path.clone()).await.unwrap();let b=open_database(path.clone()).await.unwrap();
        let (x,y)=tokio::join!(bootstrap(&a,"alpha","اول","password twelve characters"),bootstrap(&b,"beta","دوم","password twelve characters"));
        assert_ne!(x.is_ok(),y.is_ok()); let admin=if let Ok(u)=x {u} else {y.unwrap()};
        let another=create(&a,&admin.id,"other","دوم","password twelve characters","admin").await.unwrap();
        let (x,y)=tokio::join!(set_access(&a,&admin.id,&admin.id,"staff",true),set_access(&b,&another.id,&another.id,"staff",true));
        assert_ne!(x.is_ok(),y.is_ok());
        assert_eq!(sqlx::query_scalar::<_,i64>("SELECT COUNT(*) FROM local_users WHERE role='admin' AND active=1").fetch_one(&a).await.unwrap(),1);
        a.close().await;b.close().await;std::fs::remove_file(path).unwrap();
    }
}
