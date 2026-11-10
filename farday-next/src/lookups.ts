export type LookupKind='material'|'expense'|'payer'|'receipt_source';
export type PayerKind='cashbox'|'personal'|'bank'|'company';
export interface LookupInput {name:string;active:boolean;sort_order:number;unit:string|null;payer_kind:PayerKind|null;affects_balance:boolean|null}
export interface Lookup extends LookupInput {id:string;revision:number}
export interface LookupStore {list(kind:LookupKind):Promise<Lookup[]>;save(kind:LookupKind,id:string|null,revision:number|null,input:LookupInput):Promise<void>;delete(kind:LookupKind,id:string,revision:number):Promise<void>}
export const kinds:Record<LookupKind,string>={material:'مواد',expense:'انواع مصرف',payer:'پرداخت‌کنندگان',receipt_source:'منابع رسید'};
export const payerLabels:Record<PayerKind,string>={cashbox:'دخل',personal:'شخصی',bank:'بانک',company:'شرکت'};
export function blankLookup(kind:LookupKind):LookupInput {return {name:'',active:true,sort_order:10,unit:kind==='material'?'متر مکعب':null,payer_kind:kind==='payer'?'personal':null,affects_balance:kind==='receipt_source'?true:null};}
export function validateLookup(kind:LookupKind,i:LookupInput):void {
  if(!Object.hasOwn(kinds,kind)||!i.name.trim()||Array.from(i.name).length>80||typeof i.active!=='boolean'||!Number.isInteger(i.sort_order)||i.sort_order< -2147483648||i.sort_order>2147483647)throw new Error('نام یا ترتیب فهرست معتبر نیست.');
  let extras=false;
  if(kind==='material')extras=typeof i.unit==='string'&&!!i.unit.trim()&&Array.from(i.unit).length<=20&&i.payer_kind===null&&i.affects_balance===null;
  if(kind==='expense')extras=i.unit===null&&i.payer_kind===null&&i.affects_balance===null;
  if(kind==='payer')extras=i.unit===null&&i.payer_kind!==null&&Object.hasOwn(payerLabels,i.payer_kind)&&i.affects_balance===null;
  if(kind==='receipt_source')extras=i.unit===null&&i.payer_kind===null&&typeof i.affects_balance==='boolean';
  if(!extras)throw new Error('جزئیات این نوع فهرست معتبر نیست.');
}
