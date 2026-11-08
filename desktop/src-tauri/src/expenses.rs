use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use crate::service::{money, scaled, valid_date};

#[derive(Deserialize)]
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

pub(crate) async fn save(db: &SqlitePool, id: Option<String>, input: ExpenseInput) -> Result<(), String> {
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
        let n = sqlx::query("UPDATE expenses SET expense_date=?,description=?,expense_type=?,purchase_bill_no=?,shop_name=?,amount_afn_cents=?,amount_usd_cents=?,payer=?,payment_method=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(&input.date).bind(description).bind(category).bind(bill).bind(shop).bind(afn).bind(usd).bind(payer).bind(&input.payment_method).bind(notes).bind(id)
            .execute(db).await.map_err(error)?.rows_affected();
        if n == 0 { return Err("مصرف انتخاب‌شده وجود ندارد.".into()); }
    } else {
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
    async fn expense_save_edit_validates_and_persists() {
        let path = std::env::temp_dir().join(format!("expenses-{}.sqlite3", Uuid::new_v4()));
        let db = open_database(path.clone()).await.unwrap();
        save(&db, None, input()).await.unwrap();
        let e = list(&db).await.unwrap().remove(0);
        assert_eq!((e.amount_afn.as_str(), e.amount_usd.as_str()), ("100.50", "5.25"));
        let mut updated = input(); updated.payment_method = "credit".into(); updated.amount_afn = "0".into();
        save(&db, Some(e.id), updated).await.unwrap();
        let mut invalid = input(); invalid.amount_afn = "0".into(); invalid.amount_usd = "0".into();
        assert!(save(&db, None, invalid).await.is_err());
        let mut invalid = input(); invalid.date = "2025-02-29".into();
        assert!(save(&db, None, invalid).await.is_err());
        assert!(save(&db, Some("missing".into()), input()).await.is_err());
        db.close().await;
        let db = open_database(path.clone()).await.unwrap();
        let e = list(&db).await.unwrap().remove(0);
        assert_eq!((e.payment_method.as_str(), e.amount_afn.as_str(), e.amount_usd.as_str()), ("credit", "0.00", "5.25"));
        db.close().await; std::fs::remove_file(path).unwrap();
    }
}
