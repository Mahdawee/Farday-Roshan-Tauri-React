export interface CustomerInput {code:string;name:string;contact_person:string;phone:string;vehicle_plate:string;opening_balance_minor:string;address:string;notes:string}
export interface Customer extends CustomerInput {id:string;revision:number}
export interface CustomerStore {list():Promise<Customer[]>;save(id:string|null,revision:number|null,input:CustomerInput):Promise<void>;delete(id:string,revision:number):Promise<void>}
export const blankCustomer:CustomerInput={code:'',name:'',contact_person:'',phone:'',vehicle_plate:'',opening_balance_minor:'0',address:'',notes:''};
const max=9999999999999999n;
/** Parse decimal text directly into hundredths, never via Number. */
export function parseMoney(raw:string,label="مبلغ اولیه"):string {
  const fa='۰۱۲۳۴۵۶۷۸۹',ar='٠١٢٣٤٥٦٧٨٩';
  const text=raw.trim().replace(/[۰-۹٠-٩]/g,c=>String(fa.includes(c)?fa.indexOf(c):ar.indexOf(c))).replace('٫','.');
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} را با حداکثر دو رقم اعشار وارد کنید.`);
  const neg=text.startsWith('-');const [whole,fraction='']=text.replace('-','').split('.');
  if(whole.length>16)throw new Error(`${label} از محدودهٔ مجاز بیرون است.`);
  const amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));if(amount>max)throw new Error(`${label} از محدودهٔ مجاز بیرون است.`);
  return (neg&&amount!==0n?-amount:amount).toString();
}
export function formatMoney(minor:string):string {const n=BigInt(minor),a=n<0n?-n:n;return `${n<0n?'-':''}${a/100n}.${(a%100n).toString().padStart(2,'0')}`;}
const len=(s:string,n:number)=>Array.from(s).length<=n;
export function validateCustomer(i:CustomerInput):void {
  if(!i.code.trim()||!i.name.trim()||!len(i.code,20)||!len(i.name,160)||!len(i.contact_person,120)||!len(i.phone,40)||!len(i.vehicle_plate,40)||!len(i.address,255)||!len(i.notes,10000))throw new Error('کد، نام یا طول فیلدهای مشتری معتبر نیست.');
  if(!/^(?:0|[1-9]\d*|-[1-9]\d*)$/.test(i.opening_balance_minor)||BigInt(i.opening_balance_minor)>max||BigInt(i.opening_balance_minor)<-max)throw new Error('باقی ماندهٔ اولیه معتبر نیست.');
}
