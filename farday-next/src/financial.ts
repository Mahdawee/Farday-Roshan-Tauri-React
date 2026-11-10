/** Pure arithmetic foundation only, not an accounting decision or a working sales workflow. */
const volumeLimit=999999999999n,rateLimit=99999999999999n,totalLimit=9999999999999999n;
function canonical(s:string,max:bigint):bigint {
  if(s.length>17||!/^(0|[1-9]\d*|-[1-9]\d*)$/.test(s))throw new Error('invalid scaled integer');
  const n=BigInt(s);if(n>max||n< -max)throw new Error('amount exceeds field range');return n;
}
function bounded(n:bigint):string {if(n>totalLimit||n< -totalLimit)throw new Error('total exceeds field range');return n.toString();}
/** Volume in thousandths, prices in hundredths. One half-away-from-zero rounding. */
export function saleTotal(volume:string,price:string,freight:string):string {
  const v=canonical(volume,volumeLimit),p=canonical(price,rateLimit),f=canonical(freight,rateLimit),product=v*(p+f);
  return bounded(product<0n?-((-product+500n)/1000n):(product+500n)/1000n);
}
export function salaryTotal(base:string,bonus:string,overtime:string,fine:string):string {
  return bounded(canonical(base,rateLimit)+canonical(bonus,rateLimit)+canonical(overtime,rateLimit)-canonical(fine,rateLimit));
}

/** Synthetic accounting comparisons only. These do not read/write records or authorize users. */
export interface ReceiptAmount {amount:string;affects_balance:boolean}
export interface PaymentAmount {amount_afn:string;cash:boolean;payer_cashbox:boolean}
function values(xs:readonly string[]):bigint {if(xs.length>100000)throw new Error('too many records');return xs.reduce((s,x)=>s+canonical(x,totalLimit),0n);}
export function customerBalance(opening:string,creditSales:readonly string[],receipts:readonly ReceiptAmount[]):string {
  if(receipts.length>100000)throw new Error('too many records');
  // Validate all receipt values, even those which do not affect debt.
  const parsed=receipts.map(r=>({amount:canonical(r.amount,totalLimit),affects:r.affects_balance}));
  return (canonical(opening,totalLimit)+values(creditSales)-parsed.reduce((s,r)=>s+(r.affects?r.amount:0n),0n)).toString();
}
export function cashDelta(cashSales:readonly string[],receipts:readonly ReceiptAmount[],expenses:readonly PaymentAmount[],salaries:readonly PaymentAmount[],mode:'all'|'cash_only'):string {
  if(mode!=='all'&&mode!=='cash_only')throw new Error('invalid cashbox mode');
  if(receipts.length>100000||expenses.length>100000||salaries.length>100000)throw new Error('too many records');
  const incoming=values(receipts.map(r=>r.amount));
  const outgoing=[...expenses,...salaries].reduce((sum,p)=>{const amount=canonical(p.amount_afn,totalLimit);return sum+(mode==='all'||(p.cash&&p.payer_cashbox)?amount:0n);},0n);
  return (values(cashSales)+incoming-outgoing).toString();
}
export function legacyProfit(sales:readonly string[],expenses:readonly PaymentAmount[],salaries:readonly PaymentAmount[]):string {
  if(expenses.length>100000||salaries.length>100000)throw new Error('too many records');
  return (values(sales)-values(expenses.map(p=>p.amount_afn))-values(salaries.map(p=>p.amount_afn))).toString();
}
