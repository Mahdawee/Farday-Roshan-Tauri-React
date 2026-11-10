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
