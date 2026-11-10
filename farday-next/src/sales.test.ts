import {describe,it,expect} from 'vitest';
import {blankSale,formatScaled,parseScaled,validateSale} from './sales';
import {createSalePreviewStore} from './saleStore';
import {createCustomerPreviewStore} from './customerStore';
import {createLookupPreviewStore} from './lookupStore';
import {blankCustomer} from './customers';
import {blankLookup} from './lookups';
import type {Sale} from './sales';

describe('sale exact amounts',()=>{it('parses Persian digits and rejects excess precision and overflow',()=>{expect(parseScaled('۱۲٫۳۴۵',3,999999999999n,'متراژ')).toBe('12345');expect(formatScaled('-1',3)).toBe('-0.001');for(const s of ['1.2345','1e3','', '1000000000'])expect(()=>parseScaled(s,3,999999999999n,'حجم')).toThrow();expect(()=>validateSale({...blankSale,sale_date:'2023-02-29',customer_id:'a',material_id:'b'})).toThrow();});});
describe('sale preview',()=>{it('keeps numbers stable and protects referenced customer and material',async()=>{
  const rows=new Map<string,Sale>();const customers=createCustomerPreviewStore(id=>Array.from(rows.values()).some(s=>s.customer_id===id));const materials=createLookupPreviewStore(id=>Array.from(rows.values()).some(s=>s.material_id===id));const sales=createSalePreviewStore(customers,materials,rows);
  await customers.save(null,null,{...blankCustomer,code:'C1',name:'مشتری'});await materials.save('material',null,null,{...blankLookup('material'),name:'ریگ'});
  const c=(await customers.list())[0],m=(await materials.list('material'))[0];const input={...blankSale,sale_date:'2024-02-29',customer_id:c.id,material_id:m.id,volume_milli:'10000',unit_price_minor:'50000',freight_minor:'30000',payment_type:'credit' as const};
  await expect(sales.save(null,null,{...input,material_id:'missing'})).rejects.toThrow();await sales.save(null,null,input);const a=(await sales.list())[0];expect(a.sale_no).toBe('S-2024-0001');expect(a.total_minor).toBe('800000');await expect(customers.delete(c.id,c.revision)).rejects.toThrow('فروش');await expect(materials.delete('material',m.id,m.revision)).rejects.toThrow('فروش');
  await sales.save(a.id,a.revision,{...input,sale_date:'2025-01-01',freight_minor:'0'});await expect(sales.delete(a.id,a.revision)).rejects.toThrow();const b=(await sales.list())[0];expect(b.sale_no).toBe(a.sale_no);expect(b.total_minor).toBe('500000');await sales.delete(b.id,b.revision);await sales.save(null,null,input);expect((await sales.list())[0].sale_no).toBe('S-2024-0002');
});});
