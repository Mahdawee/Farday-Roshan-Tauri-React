import { describe, expect, it } from 'vitest';
import { Expense } from '../src/domain';
import { summarizeExpenses } from '../src/expenses';

const base: Expense = { id:'1', date:'2025-03-21', description:'تیل', expense_type:'سوخت', purchase_bill_no:'B-1', shop_name:'دوکان', amount_afn:'100.50', amount_usd:'5.25', payer:'دخل', payment_method:'cash', notes:'' };
const rows: Expense[] = [base, { ...base, id:'2', date:'2025-03-22', description:'پرزه', amount_afn:'200.25', amount_usd:'0.00', payment_method:'credit' }];
describe('expense filtering and currency totals', () => {
  it('uses inclusive Shamsi dates, separate exact sums and includes credit', () => {
    expect(summarizeExpenses(rows, '', '۱۴۰۴/۰۱/۰۱', '۱۴۰۴/۰۱/۰۲', 'shamsi')).toMatchObject({ afn:'300.75', usd:'5.25' });
    expect(summarizeExpenses(rows, '', '1404/01/02', '', 'shamsi')).toMatchObject({ afn:'200.25', usd:'0.00' });
    expect(summarizeExpenses(rows, 'B-1', '2025/03/21', '2025/03/21', 'miladi').rows).toHaveLength(1);
  });
  it('does not produce totals when dates are invalid or reversed', () => {
    expect(() => summarizeExpenses(rows, '', '1404/12/30', '', 'shamsi')).toThrow();
    expect(() => summarizeExpenses(rows, '', '2025/03/22', '2025/03/21', 'miladi')).toThrow();
  });
});
