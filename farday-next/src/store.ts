import {invoke,isTauri} from '@tauri-apps/api/core';
import {initialCompany,validateCompany,validateMachine} from './company';
import type {Store,Snapshot} from './company';
export const inDesktop=isTauri();
const nativeStore:Store={
  snapshot:()=>invoke('company_snapshot'),
  saveCompany:(input,revision)=>invoke('save_company',{input,revision}),
  saveMachine:(id,revision,input)=>invoke('save_machine',{id,revision,input}),
  deleteMachine:(id,revision)=>invoke('delete_machine',{id,revision}),
};
/** Memory-only and temporary; deliberately not the desktop database. */
export function createPreviewStore():Store {
  let state:Snapshot={company:structuredClone(initialCompany),machines:[]};
  return {
    async snapshot(){return structuredClone(state);},
    async saveCompany(input,revision){validateCompany(input);if(revision!==state.company.revision)throw new Error('مشخصات شرکت تغییر کرده است؛ صفحه را دوباره باز کنید.');const clean=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,typeof v==='string'?v.trim():v])) as typeof input;state.company={...clean,revision:revision+1};},
    async saveMachine(id,revision,input){validateMachine(input);input={...input,name:input.name.trim(),notes:input.notes.trim()};if(id===null && revision===null)state.machines.push({...input,name:input.name.trim(),id:crypto.randomUUID(),revision:1});else {if(id===null || revision===null)throw new Error('نسخهٔ قبلی ماشینری معتبر نیست.');const m=state.machines.find(x=>x.id===id);if(!m || m.revision!==revision)throw new Error('ماشینری تغییر کرده یا وجود ندارد؛ صفحه را دوباره باز کنید.');Object.assign(m,input,{name:input.name.trim(),revision:m.revision+1});}state.machines.sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id));},
    async deleteMachine(id,revision){const index=state.machines.findIndex(x=>x.id===id && x.revision===revision);if(index<0)throw new Error('ماشینری تغییر کرده یا وجود ندارد؛ صفحه را دوباره باز کنید.');state.machines.splice(index,1);},
  };
}
export const store:Store=inDesktop?nativeStore:createPreviewStore();
