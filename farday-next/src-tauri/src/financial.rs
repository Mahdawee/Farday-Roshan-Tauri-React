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
