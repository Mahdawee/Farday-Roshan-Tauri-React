import { describe, it, expect } from 'vitest';
import { Salary } from '../src/domain';
import { summarizeSalaries } from '../src/salaries';
const first: Salary={ id:'1', employee_id:'e1', employee_name:'کارمند', employee_code:'E1', period_calendar:'shamsi', period_year:1404, period_month:1, pay_date:'2025-03-21', base:'100.50', bonus:'0.00', fine:'0.00', overtime:'0.00', total:'100.50', payer:'', payment_type:'cash', notes:'' };
const rows: Salary[]=[first,{...first,id:'2',employee_id:'e2',pay_date:'2025-03-22',base:'0.00',fine:'20.25',total:'-20.25',payment_type:'transfer'}];
describe('salary filters',()=>{
  it('calculates exact signed totals on filtered results only',()=>{
    expect(summarizeSalaries(rows,'','','','shamsi','','').total).toBe('80.25');
    expect(summarizeSalaries(rows,'','۱۴۰۴/۰۱/۰۲','','shamsi','','').total).toBe('-20.25');
    expect(summarizeSalaries(rows,'','','','miladi','e1','cash').rows).toHaveLength(1);
    expect(summarizeSalaries(rows,'','','','miladi','e1','transfer').rows).toHaveLength(0);
  });
  it('rejects invalid and reversed payment date ranges',()=>{
    expect(()=>summarizeSalaries(rows,'','1404/12/30','','shamsi','','')).toThrow();
    expect(()=>summarizeSalaries(rows,'','2025/03/22','2025/03/21','miladi','','')).toThrow();
  });
});
