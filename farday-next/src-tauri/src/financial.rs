//! Exact arithmetic foundation. These functions are NOT yet connected to financial commands.
//! A deliberate policy (half away from zero) must be compared to live PHP and approved.
#![allow(dead_code)]
const VOLUME_LIMIT:i128=999_999_999_999; // DECIMAL(12,3), thousandths
const RATE_LIMIT:i128=99_999_999_999_999; // DECIMAL(14,2), hundredths
const TOTAL_LIMIT:i128=9_999_999_999_999_999; // DECIMAL(16,2), hundredths
fn canonical(s:&str,max:i128)->Result<i128,&'static str>{
    let digits=if let Some(rest)=s.strip_prefix('-'){rest}else{s};
    if digits.is_empty()||digits.len()>16||!digits.bytes().all(|b|b.is_ascii_digit())||(digits.len()>1&&digits.starts_with('0'))||s=="-0" {return Err("invalid scaled integer");}
    let n=s.parse::<i128>().map_err(|_|"invalid scaled integer")?;
    if n.abs()>max{return Err("amount exceeds field range");}Ok(n)
}
fn bounded(n:i128)->Result<String,&'static str>{if n.abs()>TOTAL_LIMIT {Err("total exceeds field range")}else{Ok(n.to_string())}}
/// volume is thousandths; both prices are hundredths per unit. No IEEE floating point.
/// Rounding happens once after summing goods and freight, matching the intended PHP formula.
pub(crate) fn sale_total(volume:&str,price:&str,freight:&str)->Result<String,&'static str>{
    let v=canonical(volume,VOLUME_LIMIT)?;let p=canonical(price,RATE_LIMIT)?;let f=canonical(freight,RATE_LIMIT)?;
    let product=v.checked_mul(p.checked_add(f).ok_or("overflow")?).ok_or("overflow")?;
    let rounded=if product<0 {-((-product+500)/1000)}else{(product+500)/1000};bounded(rounded)
}
/// Salary total in hundredths; negative inputs currently mirror what PHP permits, not approval.
pub(crate) fn salary_total(base:&str,bonus:&str,overtime:&str,fine:&str)->Result<String,&'static str>{
    let b=canonical(base,RATE_LIMIT)?;let x=canonical(bonus,RATE_LIMIT)?;let o=canonical(overtime,RATE_LIMIT)?;let f=canonical(fine,RATE_LIMIT)?;
    bounded(b.checked_add(x).and_then(|n|n.checked_add(o)).and_then(|n|n.checked_sub(f)).ok_or("overflow")?)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn shared_vectors(){for line in include_str!("../../contracts/financial-arithmetic.tsv").lines(){if line.is_empty()||line.starts_with('#'){continue;}let p:Vec<_>=line.split('\t').collect();match p[0]{"S"=>assert_eq!(sale_total(p[1],p[2],p[3]).unwrap(),p[4]),"P"=>assert_eq!(salary_total(p[1],p[2],p[3],p[4]).unwrap(),p[5]),_=>panic!("bad vector")}}}
    #[test] fn rejects_invalid_and_overflow(){for s in ["", "-0", "01", "+1", " 1", "1.1", "1e2", "١", "999999999999999999999999"]{assert!(sale_total(s,"0","0").is_err(),"{s}");}assert!(sale_total("1000000000000","1","0").is_err());assert!(salary_total("100000000000000","0","0","0").is_err());assert!(sale_total("999999999999","99999999999999","99999999999999").is_err());}
}

#[derive(Clone,Debug)]
pub(crate) struct ReceiptAmount {pub amount:String,pub affects_balance:bool}
#[derive(Clone,Debug)]
pub(crate) struct PaymentAmount {pub amount_afn:String,pub cash:bool,pub payer_cashbox:bool}
#[derive(Clone,Copy)]
pub(crate) enum CashMode {All,CashOnly}
fn sum_amounts<'a>(values:impl Iterator<Item=&'a str>)->Result<i128,&'static str>{
    let mut sum=0i128;let mut count=0usize;
    for value in values {count+=1;if count>100_000{return Err("too many records");}sum=sum.checked_add(canonical(value,TOTAL_LIMIT)?).ok_or("overflow")?;}Ok(sum)
}
pub(crate) fn customer_balance(opening:&str,credit_sales:&[String],receipts:&[ReceiptAmount])->Result<String,&'static str>{
    if receipts.len()>100_000{return Err("too many records");}let mut balance=canonical(opening,TOTAL_LIMIT)?.checked_add(sum_amounts(credit_sales.iter().map(|s|s.as_str()))?).ok_or("overflow")?;
    for r in receipts {let amount=canonical(&r.amount,TOTAL_LIMIT)?;if r.affects_balance {balance=balance.checked_sub(amount).ok_or("overflow")?;}}Ok(balance.to_string())
}
pub(crate) fn cash_delta(cash_sales:&[String],receipts:&[ReceiptAmount],expenses:&[PaymentAmount],salaries:&[PaymentAmount],mode:CashMode)->Result<String,&'static str>{
    if receipts.len()>100_000||expenses.len()>100_000||salaries.len()>100_000{return Err("too many records");}
    let mut result=sum_amounts(cash_sales.iter().map(|s|s.as_str()))?.checked_add(sum_amounts(receipts.iter().map(|r|r.amount.as_str()))?).ok_or("overflow")?;
    for p in expenses.iter().chain(salaries.iter()){let amount=canonical(&p.amount_afn,TOTAL_LIMIT)?;if matches!(mode,CashMode::All)||(p.cash&&p.payer_cashbox){result=result.checked_sub(amount).ok_or("overflow")?;}}Ok(result.to_string())
}
pub(crate) fn legacy_profit(sales:&[String],expenses:&[PaymentAmount],salaries:&[PaymentAmount])->Result<String,&'static str>{
    if expenses.len()>100_000||salaries.len()>100_000{return Err("too many records");}
    let sales=sum_amounts(sales.iter().map(|s|s.as_str()))?;
    let expenses=sum_amounts(expenses.iter().map(|p|p.amount_afn.as_str()))?;let salaries=sum_amounts(salaries.iter().map(|p|p.amount_afn.as_str()))?;
    Ok(sales.checked_sub(expenses).and_then(|s|s.checked_sub(salaries)).ok_or("overflow")?.to_string())
}
#[cfg(test)]
mod comparison_tests {
    use super::*;
    #[test] fn synthetic_reference_not_an_accounting_approval(){
        let receipts=vec![ReceiptAmount{amount:"120000".into(),affects_balance:true},ReceiptAmount{amount:"30000".into(),affects_balance:false}];
        let expenses=vec![PaymentAmount{amount_afn:"12000".into(),cash:true,payer_cashbox:true},PaymentAmount{amount_afn:"8000".into(),cash:false,payer_cashbox:false}];
        let salaries=vec![PaymentAmount{amount_afn:"7000".into(),cash:true,payer_cashbox:true},PaymentAmount{amount_afn:"3000".into(),cash:false,payer_cashbox:false}];
        let credit=vec![sale_total("10000","50000","30000").unwrap()];assert_eq!(customer_balance("100000",&credit,&receipts).unwrap(),"780000");
        assert_eq!(cash_delta(&["50000".into()],&receipts,&expenses,&salaries,CashMode::All).unwrap(),"170000");assert_eq!(cash_delta(&["50000".into()],&receipts,&expenses,&salaries,CashMode::CashOnly).unwrap(),"181000");
        assert_eq!(legacy_profit(&["800000".into(),"50000".into()],&expenses,&salaries).unwrap(),"820000");
        let bad=vec![ReceiptAmount{amount:"1.0".into(),affects_balance:false}];assert!(customer_balance("0",&[],&bad).is_err());
    }
}
