import {invoke} from '@tauri-apps/api/core';
import {inDesktop} from './store';
import {validateEmployee} from './employees';
import type {Employee,EmployeeInput,EmployeeStore} from './employees';
const native:EmployeeStore={list:()=>invoke('list_employees'),save:(id,revision,input)=>invoke('save_employee',{id,revision,input}),delete:(id,revision)=>invoke('delete_employee',{id,revision})};
const asciiFold=(s:string)=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
export function createEmployeePreviewStore():EmployeeStore {
  let items:Employee[]=[];
  return {
    async list(){return structuredClone(items.slice().sort((a,b)=>(a.status==='active'?0:1)-(b.status==='active'?0:1)||asciiFold(a.emp_code).localeCompare(asciiFold(b.emp_code))||a.id.localeCompare(b.id)));},
    async save(id,revision,input){validateEmployee(input);const clean=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v.trim()])) as unknown as EmployeeInput;
      if((id===null)!==(revision===null))throw new Error('نسخهٔ قبلی کارمند معتبر نیست.');
      const current=id===null?undefined:items.find(e=>e.id===id&&e.revision===revision);if(id!==null&&!current)throw new Error('کارمند تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');
      if(items.some(e=>e.id!==id&&asciiFold(e.emp_code)===asciiFold(clean.emp_code)))throw new Error('کد کارمند تکراری است.');
      if(current)Object.assign(current,clean,{revision:current.revision+1});else items.push({...clean,id:crypto.randomUUID(),revision:1});},
    async delete(id,revision){const idx=items.findIndex(e=>e.id===id&&e.revision===revision);if(idx<0)throw new Error('کارمند تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');items.splice(idx,1);},
  };
}
export const employeeStore:EmployeeStore=inDesktop?native:createEmployeePreviewStore();
