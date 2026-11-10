import {invoke} from '@tauri-apps/api/core';
import {inDesktop} from './store';
import {kinds,validateLookup} from './lookups';
import {materialHasSales} from './previewSales';
import type {Lookup,LookupKind,LookupStore} from './lookups';
const native:LookupStore={list:(kind)=>invoke('list_lookups',{kind}),save:(kind,id,revision,input)=>invoke('save_lookup',{kind,id,revision,input}),delete:(kind,id,revision)=>invoke('delete_lookup',{kind,id,revision})};
const asciiFold=(s:string)=>s.replace(/[A-Z]/g,c=>c.toLowerCase());
export function createLookupPreviewStore(hasMaterialSales:(id:string)=>boolean=()=>false):LookupStore {
  const tables:Record<LookupKind,Lookup[]>={material:[],expense:[],payer:[],receipt_source:[]};
  return {
    async list(kind){if(!Object.hasOwn(kinds,kind))throw new Error('نوع فهرست معتبر نیست.');return structuredClone(tables[kind].slice().sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)));},
    async save(kind,id,revision,input){validateLookup(kind,input);const clean={name:input.name.trim(),active:input.active,sort_order:input.sort_order,unit:input.unit?.trim()??null,payer_kind:input.payer_kind,affects_balance:input.affects_balance};
      if((id===null)!==(revision===null))throw new Error('نسخهٔ قبلی ردیف معتبر نیست.');
      const row=id===null?undefined:tables[kind].find(x=>x.id===id&&x.revision===revision);if(id!==null&&!row)throw new Error('ردیف تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');
      if(tables[kind].some(x=>x.id!==id&&asciiFold(x.name)===asciiFold(clean.name)))throw new Error('این نام در همین فهرست تکراری است.');
      if(row)Object.assign(row,clean,{revision:row.revision+1});else tables[kind].push({...clean,id:crypto.randomUUID(),revision:1});},
    async delete(kind,id,revision){if(!Object.hasOwn(kinds,kind))throw new Error('نوع فهرست معتبر نیست.');const idx=tables[kind].findIndex(x=>x.id===id&&x.revision===revision);if(kind==='material'&&hasMaterialSales(id))throw new Error('این ماده در فروش استفاده شده و حذف نمی‌شود؛ آن را غیرفعال کنید.');if(idx<0)throw new Error('ردیف تغییر کرده یا وجود ندارد؛ فهرست را دوباره بخوانید.');tables[kind].splice(idx,1);},
  };
}
export const lookupStore:LookupStore=inDesktop?native:createLookupPreviewStore(materialHasSales);
