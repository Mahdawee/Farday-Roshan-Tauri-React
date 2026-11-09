import { describe, expect, it } from 'vitest';
import { legacySimpleCashDelta } from '../src/legacy-cash';
import type { RangeSummary } from '../src/domain';
const base:RangeSummary={sales_count:1,sales_cash:'1.25',sales_credit:'105.00',volume:'106.250',receipts_count:2,receipts_effective:'2.00',receipts_deposit:'3.00',expenses_count:1,expenses_afn:'1.20',expenses_usd:'3.40',salaries_count:1,salaries_afn:'-2.00'};
describe('experimental comparison with old simple cash flow',()=>{
  it('includes all receipts, expenses and negative salary without currency conversion',()=>{
    expect(legacySimpleCashDelta(base)).toBe('7.05');
    expect(legacySimpleCashDelta({...base,sales_credit:'999999999.00',expenses_usd:'999999999.00'})).toBe('7.05');
    expect(legacySimpleCashDelta({...base,salaries_afn:'10.00'})).toBe('-4.95');
  });
  it('handles aggregate values beyond individual input limits exactly',()=>{
    expect(legacySimpleCashDelta({...base,sales_cash:'99999999999999999999.99'})).toBe('100000000000000000005.79');
    expect(()=>legacySimpleCashDelta({...base,sales_cash:'NaN'})).toThrow('معتبر نیست');
  });
});
