import type { Ledger, LedgerRow } from './domain';

/** Slice a chronological, already calculated ledger without recalculating with floats.
 * Dates are canonical ISO, inclusive; null means unbounded. A deposit row's
 * balance is already unchanged by the ledger service. */
export function ledgerRange(ledger: Ledger, from: string | null, to: string | null): { opening: string; closing: string; rows: LedgerRow[] } {
  let opening = ledger.opening;
  const rows: LedgerRow[] = [];
  for (const row of ledger.rows) {
    if (from && row.date < from) { opening = row.balance; continue; }
    if (!to || row.date <= to) rows.push(row);
  }
  return { opening, closing: rows.length ? rows[rows.length - 1].balance : opening, rows };
}
