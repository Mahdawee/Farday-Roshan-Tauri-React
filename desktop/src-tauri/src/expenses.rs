use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize, Clone)]
pub(crate) struct ExpenseInput {
    date: String, description: String, expense_type: String, purchase_bill_no: String,
    shop_name: String, amount_afn: String, amount_usd: String, payer: String,
    payment_method: String, notes: String,
}
#[derive(Serialize)]
pub(crate) struct Expense {
    id: String, date: String, description: String, expense_type: String, purchase_bill_no: String,
    shop_name: String, amount_afn: String, amount_usd: String, payer: String,
    payment_method: String, notes: String,
}
fn error(err: sqlx::Error) -> String {
    eprintln!("Expense database error: {err}");
    "عملیات مصرف انجام نشد؛ دوباره تلاش کنید.".into()
}

pub(crate) async fn list(db: &SqlitePool) -> Result<Vec<Expense>, String> {
    let rows = sqlx::query("SELECT id,expense_date,description,expense_type,purchase_bill_no,shop_name,amount_afn_cents,amount_usd_cents,payer,payment_method,notes FROM expenses ORDER BY expense_date DESC,created_at DESC,id DESC")
        .fetch_all(db).await.map_err(error)?;
    rows.into_iter().map(|r| Ok(Expense {
        id: r.try_get("id").map_err(error)?, date: r.try_get("expense_date").map_err(error)?,
        description: r.try_get("description").map_err(error)?, expense_type: r.try_get("expense_type").map_err(error)?,
        purchase_bill_no: r.try_get("purchase_bill_no").map_err(error)?, shop_name: r.try_get("shop_name").map_err(error)?,
        amount_afn: money(r.try_get("amount_afn_cents").map_err(error)?), amount_usd: money(r.try_get("amount_usd_cents").map_err(error)?),
        payer: r.try_get("payer").map_err(error)?, payment_method: r.try_get("payment_method").map_err(error)?, notes: r.try_get("notes").map_err(error)?,
    })).collect()
}

pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: ExpenseInput, expected: Option<ExpenseInput>) -> Result<(), String> {
    valid_date(&input.date)?;
    let description = input.description.trim(); let category = input.expense_type.trim();
    let bill = input.purchase_bill_no.trim(); let shop = input.shop_name.trim();
    let payer = input.payer.trim(); let notes = input.notes.trim();
    if description.is_empty() { return Err("شرح مصرف الزامی است.".into()); }
    if description.len() > 1000 || category.len() > 320 || bill.len() > 320 || shop.len() > 320 || payer.len() > 320 || notes.len() > 4000 {
        return Err("متن واردشده بیش از حد طولانی است.".into());
    }
    if !matches!(input.payment_method.as_str(), "cash" | "credit") { return Err("روش پرداخت معتبر نیست.".into()); }
    let afn = scaled(&input.amount_afn, 2)?; let usd = scaled(&input.amount_usd, 2)?;
    if afn == 0 && usd == 0 { return Err("حداقل یکی از مبلغ‌های افغانی یا دالری باید بیشتر از صفر باشد.".into()); }
    if let Some(id) = id {
        let expected=expected.ok_or("نسخهٔ قبلی مصرف لازم است؛ فرم را دوباره باز کنید.")?;
        let old_afn=scaled(&expected.amount_afn,2)?; let old_usd=scaled(&expected.amount_usd,2)?;
        let n = sqlx::query("UPDATE expenses SET expense_date=?,description=?,expense_type=?,purchase_bill_no=?,shop_name=?,amount_afn_cents=?,amount_usd_cents=?,payer=?,payment_method=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND expense_date=? AND description=? AND expense_type=? AND purchase_bill_no=? AND shop_name=? AND amount_afn_cents=? AND amount_usd_cents=? AND payer=? AND payment_method=? AND notes=?")
            .bind(&input.date).bind(description).bind(category).bind(bill).bind(shop).bind(afn).bind(usd).bind(payer).bind(&input.payment_method).bind(notes).bind(id)
            .bind(expected.date).bind(expected.description).bind(expected.expense_type).bind(expected.purchase_bill_no).bind(expected.shop_name).bind(old_afn).bind(old_usd).bind(expected.payer).bind(expected.payment_method).bind(expected.notes)
            .execute(db).await.map_err(error)?.rows_affected();
        if n == 0 { return Err("مصرف تغییر کرده یا وجود ندارد؛ فرم را ببندید و دوباره باز کنید.".into()); }
    } else {
        if expected.is_some() {return Err("نسخهٔ قبلی برای مصرف جدید قابل استفاده نیست.".into());}
        sqlx::query("INSERT INTO expenses(id,expense_date,description,expense_type,purchase_bill_no,shop_name,amount_afn_cents,amount_usd_cents,payer,payment_method,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
            .bind(Uuid::new_v4().to_string()).bind(&input.date).bind(description).bind(category).bind(bill).bind(shop).bind(afn).bind(usd).bind(payer).bind(&input.payment_method).bind(notes)
            .execute(db).await.map_err(error)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::service::open_database;
    fn input() -> ExpenseInput { ExpenseInput { date:"2026-03-21".into(), description:"تیل".into(), expense_type:"سوخت".into(), purchase_bill_no:"B-1".into(), shop_name:"دوکان".into(), amount_afn:"۱۰۰.۵۰".into(), amount_usd:"5.25".into(), payer:"دخل".into(), payment_method:"cash".into(), notes:"یادداشت".into() } }
    #[tokio::test]
    async fn stale_edits_are_rejected_across_connections_even_in_the_same_second() {
        let path=std::env::temp_dir().join(format!("expense-conflict-{}.sqlite3",Uuid::new_v4()));
        let first=open_database(path.clone()).await.unwrap();let second=open_database(path.clone()).await.unwrap();
        save(&first,None,input(),None).await.unwrap(); let row=list(&first).await.unwrap().remove(0); let id=row.id;
        let old=input(); let mut a=input(); a.notes="اول".into();let mut b=input();b.amount_usd="9".into();
        let (a_result,b_result)=tokio::join!(save(&first,Some(id.clone()),a,Some(old.clone())),save(&second,Some(id.clone()),b,Some(old.clone())));
        assert_ne!(a_result.is_ok(),b_result.is_ok());
        let result=list(&first).await.unwrap().remove(0);
        assert!(result.notes=="اول" && result.amount_usd=="5.25" || result.notes=="یادداشت" && result.amount_usd=="9.00");
        assert!(save(&first,Some(id.clone()),input(),None).await.is_err());
        assert!(save(&first,Some(id),input(),Some(old)).await.is_err());
        first.close().await;second.close().await;std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn expense_save_edit_validates_and_persists() {
        let path = std::env::temp_dir().join(format!("expenses-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        save(&db, None, input(), None).await.unwrap();
        let e = list(&db).await.unwrap().remove(0);
        assert_eq!((e.amount_afn.as_str(), e.amount_usd.as_str()), ("100.50", "5.25"));
        let mut updated = input(); updated.payment_method = "credit".into(); updated.amount_afn = "0".into();
        save(&db, Some(e.id), updated, Some(input())).await.unwrap();
        let mut invalid = input(); invalid.amount_afn = "0".into(); invalid.amount_usd = "0".into();
        assert!(save(&db, None, invalid, None).await.is_err());
        let mut invalid = input(); invalid.date = "2025-02-29".into();
        assert!(save(&db, None, invalid, None).await.is_err());
        assert!(save(&db, Some("missing".into()), input(), Some(input())).await.is_err());
        db.close().await;
        let db = open_database(path.clone()).await.unwrap();
        let e = list(&db).await.unwrap().remove(0);
        assert_eq!((e.payment_method.as_str(), e.amount_afn.as_str(), e.amount_usd.as_str()), ("credit", "0.00", "5.25"));
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
