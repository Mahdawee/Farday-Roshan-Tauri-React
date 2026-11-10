import {describe,it,expect} from 'vitest';
import {blankCustomer,formatMoney,parseMoney,validateCustomer} from './customers';
import {createCustomerPreviewStore} from './customerStore';

describe('exact opening balance',()=>{
  it('converts without floating point and supports Persian digits',()=>{expect(parseMoney('۱۲۳٫۴۵')).toBe('12345');expect(parseMoney('-٠.٠١')).toBe('-1');expect(parseMoney('99999999999999.99')).toBe('9999999999999999');expect(formatMoney('-1')).toBe('-0.01');expect(formatMoney('9999999999999999')).toBe('99999999999999.99');expect(parseMoney('-0.00')).toBe('0');});
  it('rejects precision loss, malformed and out-of-range values',()=>{for(const s of ['1.999','1e2','', '1.', '100000000000000.00','1,000','+3'])expect(()=>parseMoney(s)).toThrow();expect(()=>validateCustomer({...blankCustomer,code:'A',name:'B',opening_balance_minor:'-0'})).toThrow();});
});
describe('preview customer master',()=>{it('enforces unique code, revisions and temporary storage',async()=>{const store=createCustomerPreviewStore();const input={...blankCustomer,code:'CUS-001',name:'مشتری',opening_balance_minor:'9999999999999999'};await store.save(null,null,input);await expect(store.save(null,null,{...input,code:'cus-001'})).rejects.toThrow('تکراری');const first=(await store.list())[0];await store.save(first.id,first.revision,{...input,name:'مشتری جدید'});await expect(store.delete(first.id,first.revision)).rejects.toThrow();const updated=(await store.list())[0];expect(updated.opening_balance_minor).toBe('9999999999999999');await store.delete(updated.id,updated.revision);expect(await store.list()).toHaveLength(0);expect(await createCustomerPreviewStore().list()).toHaveLength(0);});});
