export type MachineStatus='active'|'inactive'|'repair';
export interface CompanyInput { name:string;activity_type:string;address:string;finance_manager:string;supervisor:string;fiscal_year_note:string;employees_count:number;phone:string;email:string;license_no:string;notes:string }
export interface Company extends CompanyInput {revision:number}
export interface MachineInput {name:string;count:number;status:MachineStatus;notes:string;sort_order:number}
export interface Machine extends MachineInput {id:string;revision:number}
export interface Snapshot {company:Company;machines:Machine[]}
export interface Store { snapshot():Promise<Snapshot>;saveCompany(input:CompanyInput,revision:number):Promise<void>;saveMachine(id:string|null,revision:number|null,input:MachineInput):Promise<void>;deleteMachine(id:string,revision:number):Promise<void> }
export const initialCompany:Company={name:'شرکت فردای روشن',activity_type:'تولید مواد ساختمانی',address:'',finance_manager:'',supervisor:'',fiscal_year_note:'',employees_count:0,phone:'',email:'',license_no:'',notes:'',revision:1};
export const blankMachine:MachineInput={name:'',count:1,status:'active',notes:'',sort_order:10};
const len=(s:string,n:number)=>Array.from(s).length<=n;
export function validateCompany(i:CompanyInput):void {
  if(!i.name.trim() || !len(i.name,120)||!len(i.activity_type,120)||!len(i.address,255)||!len(i.finance_manager,120)||!len(i.supervisor,120)||!len(i.fiscal_year_note,60)||!len(i.phone,60)||!len(i.email,120)||!len(i.license_no,60)||!len(i.notes,10000)||!Number.isInteger(i.employees_count)||i.employees_count<0||i.employees_count>2147483647) throw new Error('نام شرکت و طول فیلدها یا تعداد کارمندان معتبر نیست.');
}
export function validateMachine(i:MachineInput):void {
  if(!i.name.trim()||!len(i.name,120)||!len(i.notes,255)||!Number.isInteger(i.count)||i.count<1||i.count>2147483647||!Number.isInteger(i.sort_order)||i.sort_order< -2147483648||i.sort_order>2147483647||!['active','inactive','repair'].includes(i.status)) throw new Error('معلومات ماشینری معتبر نیست؛ نام، تعداد، ترتیب و وضعیت را بررسی کنید.');
}
export function integer(raw:string):number {
  const fa='۰۱۲۳۴۵۶۷۸۹',ar='٠١٢٣٤٥٦٧٨٩';
  const text=raw.trim().replace(/[۰-۹٠-٩]/g,c=>String(fa.includes(c)?fa.indexOf(c):ar.indexOf(c)));
  return /^-?\d+$/.test(text)?Number(text):NaN;
}
