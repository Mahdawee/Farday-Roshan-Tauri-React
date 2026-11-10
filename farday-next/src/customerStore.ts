import {invoke} from '@tauri-apps/api/core';
import {inDesktop} from './store';
import {validateCustomer} from './customers';
import type {Customer,CustomerInput,CustomerStore} from './customers';
const native:CustomerStore={list:()=>invoke('list_customers'),save:(id,revision,input)=>invoke('save_customer',{id,revision,input}),delete:(id,revision)=>invoke('delete_customer',{id,revision})};
const asciiFold=(s:string)=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
export function createCustomerPreviewStore():CustomerStore {
  let items:Customer[]=[];
  return {
    async list(){return structuredClone(items.slice().sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)));},
    async save(id,revision,input){validateCustomer(input);const clean=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v.trim()])) as unknown as CustomerInput;
      if((id===null)!==(revision===null))throw new Error('نسخهٔ قبلی مشتری معتبر نیست.');
      const existing=id===null?undefined:items.find(c=>c.id===id&&c.revision===revision);if(id!==null&&!existing)throw new Error('مشتری تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');
      if(items.some(c=>c.id!==id&&asciiFold(c.code)===asciiFold(clean.code)))throw new Error('کد مشتری تکراری است.');
      if(existing)Object.assign(existing,clean,{revision:existing.revision+1});else items.push({...clean,id:crypto.randomUUID(),revision:1});},
    async delete(id,revision){const index=items.findIndex(c=>c.id===id&&c.revision===revision);if(index<0)throw new Error('مشتری تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');items.splice(index,1);},
  };
}
export const customerStore:CustomerStore=inDesktop?native:createCustomerPreviewStore();
