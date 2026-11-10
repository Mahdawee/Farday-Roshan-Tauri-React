import {invoke} from '@tauri-apps/api/core';
import {inDesktop} from './store';
import {customerStore} from './customerStore';
import {lookupStore} from './lookupStore';
import type {CustomerStore} from './customers';
import type {LookupStore} from './lookups';
import {blankSale,validateSale} from './sales';
import type {Sale,SaleInput,SaleStore} from './sales';
import {previewSales,previewSalesCounters} from './previewSales';
const native:SaleStore={list:()=>invoke('list_sales'),save:(id,revision,input)=>invoke('save_sale',{id,revision,input}),delete:(id,revision)=>invoke('delete_sale',{id,revision})};
export function createSalePreviewStore(customers:CustomerStore,materials:LookupStore,sales:Map<string,Sale>=new Map(),counters:Map<number,number>=new Map()):SaleStore {
  return {
    async list(){const [cs,ms]=await Promise.all([customers.list(),materials.list('material')]);return Array.from(sales.values()).map(s=>{const c=cs.find(x=>x.id===s.customer_id),m=ms.find(x=>x.id===s.material_id);return {...s,customer_name:c?.name??s.customer_name,customer_code:c?.code??s.customer_code,material_name:m?.name??s.material_name,material_active:m?.active??false};}).sort((a,b)=>b.sale_date.localeCompare(a.sale_date)||b.sale_no.localeCompare(a.sale_no)).map(s=>structuredClone(s));},
    async save(id,revision,input){const total=validateSale(input);if((id===null)!==(revision===null))throw new Error('نسخهٔ فروش معتبر نیست.');const old=id===null?undefined:sales.get(id);if(id!==null&&(!old||old.revision!==revision))throw new Error('فروش تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');
      const [cs,ms]=await Promise.all([customers.list(),materials.list('material')]);const c=cs.find(x=>x.id===input.customer_id),m=ms.find(x=>x.id===input.material_id);if(!c||!m||(!m.active&&old?.material_id!==m.id))throw new Error('مشتری وجود ندارد یا مواد انتخاب‌شده فعال نیست.');
      const clean=Object.fromEntries((Object.keys(blankSale) as (keyof SaleInput)[]).map(k=>[k,input[k].trim()])) as unknown as SaleInput;
      if(old)Object.assign(old,clean,{total_minor:total,revision:old.revision+1});else{const year=Number(input.sale_date.slice(0,4)),num=(counters.get(year)??0)+1;if(num>999999999)throw new Error('شمارهٔ فروش از محدوده بیرون است.');counters.set(year,num);const id=crypto.randomUUID();sales.set(id,{...clean,id,sale_no:`S-${String(year).padStart(4,'0')}-${String(num).padStart(4,'0')}`,total_minor:total,customer_name:c.name,customer_code:c.code,material_name:m.name,material_active:m.active,revision:1});}},
    async delete(id,revision){const sale=sales.get(id);if(!sale||sale.revision!==revision)throw new Error('فروش تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');sales.delete(id);},
  };
}
export const saleStore:SaleStore=inDesktop?native:createSalePreviewStore(customerStore,lookupStore,previewSales,previewSalesCounters);
