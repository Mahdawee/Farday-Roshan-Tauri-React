import { formatScaled, type RangeSummary } from './domain';

// RangeSummary carries canonical signed decimal strings. Do not use JS numbers
// or parseScaled's per-input limit for sums across an entire date range.
function cents(value:string):bigint {
  const match=/^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error('جمع راپور معتبر نیست.');
  const n=BigInt(match[2])*100n+BigInt(match[3]);
  return match[1] ? -n : n;
}

/** Comparison to the old application's `all` cash-flow formula, not cash on hand. */
export function legacySimpleCashDelta(data:RangeSummary):string {
  return formatScaled(cents(data.sales_cash)+cents(data.receipts_effective)+cents(data.receipts_deposit)-cents(data.expenses_afn)-cents(data.salaries_afn));
}
