import {validDate} from './employees';
import {saleTotal} from './financial';
export interface SaleInput {sale_date:string;customer_id:string;material_id:string;bill_no:string;driver_name:string;vehicle_plate:string;destination:string;related_to:string;volume_milli:string;unit_price_minor:string;freight_minor:string;payment_type:'cash'|'credit';notes:string}
export interface Sale extends SaleInput {id:string;sale_no:string;total_minor:string;customer_name:string;customer_code:string;material_name:string;material_active:boolean;revision:number}
export interface SaleStore {list():Promise<Sale[]>;save(id:string|null,revision:number|null,input:SaleInput):Promise<void>;delete(id:string,revision:number):Promise<void>}
export const blankSale:SaleInput={sale_date:'',customer_id:'',material_id:'',bill_no:'',driver_name:'',vehicle_plate:'',destination:'',related_to:'',volume_milli:'0',unit_price_minor:'0',freight_minor:'0',payment_type:'cash',notes:''};
export function parseScaled(raw:string,scale:number,max:bigint,label:string):string {
  const fa='۰۱۲۳۴۵۶۷۸۹',ar='٠١٢٣٤٥٦٧٨٩';const text=raw.trim().replace(/[۰-۹٠-٩]/g,c=>String(fa.includes(c)?fa.indexOf(c):ar.indexOf(c))).replace('٫','.');
  if(!new RegExp(`^-?\\d+(?:\\.\\d{1,${scale}})?$`).test(text))throw new Error(`${label} معتبر نیست.`);
  const negative=text.startsWith('-');const [whole,dec='']=text.replace('-','').split('.');if(whole.length>16)throw new Error(`${label} از محدودهٔ مجاز بیرون است.`);
  const n=BigInt(whole)*10n**BigInt(scale)+BigInt(dec.padEnd(scale,'0'));if(n>max)throw new Error(`${label} از محدودهٔ مجاز بیرون است.`);return (negative&&n!==0n?-n:n).toString();
}
export function formatScaled(raw:string,scale:number):string{const n=BigInt(raw),a=n<0n?-n:n,base=10n**BigInt(scale);return `${n<0n?'-':''}${a/base}.${String(a%base).padStart(scale,'0')}`;}
export function validateSale(i:SaleInput):string {
  const len=(s:string,n:number)=>Array.from(s).length<=n;
  if(!i.sale_date||!validDate(i.sale_date)||!i.customer_id||i.customer_id.length>64||!i.material_id||i.material_id.length>64||!len(i.bill_no,30)||!len(i.driver_name,120)||!len(i.vehicle_plate,40)||!len(i.destination,160)||!len(i.related_to,160)||!len(i.notes,10000)||!['cash','credit'].includes(i.payment_type))throw new Error('تاریخ، مشتری، مواد یا فیلدهای فروش معتبر نیست.');
  try{return saleTotal(i.volume_milli,i.unit_price_minor,i.freight_minor);}catch{throw new Error('عدد یا مجموع فروش معتبر نیست یا از محدوده بیرون است.');}
}
