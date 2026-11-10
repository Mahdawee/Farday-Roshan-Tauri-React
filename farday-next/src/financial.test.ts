import {describe,it,expect} from 'vitest';
import vectors from '../contracts/financial-arithmetic.tsv?raw';
import {saleTotal,salaryTotal} from './financial';
describe('exact financial arithmetic (not accounting-approved)',()=>{
  it('matches shared decimal reference vectors',()=>{for(const line of vectors.split('\n')){if(!line||line.startsWith('#'))continue;const p=line.split('\t');if(p[0]==='S')expect(saleTotal(p[1],p[2],p[3])).toBe(p[4]);else if(p[0]==='P')expect(salaryTotal(p[1],p[2],p[3],p[4])).toBe(p[5]);else throw new Error('bad vector');}});
  it('rejects noncanonical numbers, range and total overflow',()=>{for(const s of ['', '-0','01','+1',' 1','1.1','1e2','١','999999999999999999999999'])expect(()=>saleTotal(s,'0','0')).toThrow();expect(()=>saleTotal('1000000000000','1','0')).toThrow();expect(()=>salaryTotal('100000000000000','0','0','0')).toThrow();expect(()=>saleTotal('999999999999','99999999999999','99999999999999')).toThrow();});
});

import {customerBalance,cashDelta,legacyProfit} from './financial';
import scenario from '../contracts/financial-example.json';
const minor=(value:string)=>{const [whole,dec='']=value.split('.');return (BigInt(whole)*100n+BigInt(dec.padEnd(2,'0'))).toString();};
it('checks synthetic customer, cashbox and legacy profit scenarios exactly',()=>{
  const receipts=scenario.receipts.map(r=>({amount:minor(r.amount),affects_balance:r.affects_balance}));
  const expenses=scenario.expenses.map(p=>({amount_afn:minor(p.amount_afn),cash:p.payment==='cash',payer_cashbox:p.payer_kind==='cashbox'}));
  const salaries=scenario.salaries.map(p=>({amount_afn:minor(p.amount_afn),cash:p.payment==='cash',payer_cashbox:p.payer_kind==='cashbox'}));
  const credit=saleTotal('10000','50000','30000');expect(customerBalance(minor(scenario.opening_customer_debt),[credit],receipts)).toBe(minor(scenario.expected.customer_balance));
  expect(cashDelta([minor(scenario.cash_sale)],receipts,expenses,salaries,'all')).toBe(minor(scenario.expected.legacy_simple_cash_delta));
  expect(cashDelta([minor(scenario.cash_sale)],receipts,expenses,salaries,'cash_only')).toBe(minor(scenario.expected.legacy_cash_only_delta));
  expect(legacyProfit([credit,minor(scenario.cash_sale)],expenses,salaries)).toBe(minor(scenario.expected.legacy_profit_formula));
  expect(()=>customerBalance('0',[],[{amount:'1.0',affects_balance:false}])).toThrow();
});
