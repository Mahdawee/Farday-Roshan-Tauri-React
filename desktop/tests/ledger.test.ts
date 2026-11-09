import { describe, expect, it } from 'vitest';
import { ledgerRange } from '../src/ledger';
import type { Ledger, LedgerRow } from '../src/domain';

const row=(id:string,date:string,balance:string,affects=true):LedgerRow=>({id,date,document_number:null,kind:'receipt',detail:'رسید',debit:'0.00',credit:'10.00',affects_balance:affects,balance});
const ledger:Ledger={customer_name:'مشتری',customer_code:'C',opening:'100.00',balance:'65.00',rows:[
  row('a','2025-01-01','90.00'),row('b','2025-01-02','90.00',false),row('c','2025-01-02','80.00'),row('d','2025-01-03','65.00')
]};
describe('customer ledger range',()=>{
  it('uses balances from all preceding rows and includes both endpoints',()=>{
    const result=ledgerRange(ledger,'2025-01-02','2025-01-02');
    expect(result.opening).toBe('90.00'); expect(result.closing).toBe('80.00'); expect(result.rows.map(r=>r.id)).toEqual(['b','c']);
    expect(result.rows[0].affects_balance).toBe(false);
  });
  it('handles empty ranges and unbounded edges without treating deposits as payments',()=>{
    expect(ledgerRange(ledger,'2024-01-01','2024-12-31')).toMatchObject({opening:'100.00',closing:'100.00',rows:[]});
    expect(ledgerRange(ledger,'2025-01-04',null)).toMatchObject({opening:'65.00',closing:'65.00',rows:[]});
    expect(ledgerRange(ledger,null,'2025-01-02').closing).toBe('80.00');
    expect(ledgerRange(ledger,null,null)).toMatchObject({opening:'100.00',closing:'65.00'});
    const onlyDeposit:Ledger={...ledger,rows:[row('deposit','2025-01-02','100.00',false)]};
    expect(ledgerRange(onlyDeposit,'2025-01-03',null)).toMatchObject({opening:'100.00',closing:'100.00'});
  });
});
