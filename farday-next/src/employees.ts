export type EmployeeStatus='active'|'inactive';
export interface EmployeeInput {emp_code:string;full_name:string;father_name:string;job_title:string;hire_date:string;base_salary_minor:string;phone:string;tazkira_no:string;address:string;contract_duration:string;status:EmployeeStatus;notes:string}
export interface Employee extends EmployeeInput {id:string;revision:number}
export interface EmployeeStore {list():Promise<Employee[]>;save(id:string|null,revision:number|null,input:EmployeeInput):Promise<void>;delete(id:string,revision:number):Promise<void>}
export const blankEmployee:EmployeeInput={emp_code:'',full_name:'',father_name:'',job_title:'',hire_date:'',base_salary_minor:'0',phone:'',tazkira_no:'',address:'',contract_duration:'',status:'active',notes:''};
const max=99999999999999n;
const len=(s:string,n:number)=>Array.from(s).length<=n;
/** Empty or validated Gregorian YYYY-MM-DD; does not interpret a Shamsi year as Gregorian. */
export function validDate(s:string):boolean {
  if(s==='')return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [year,month,day]=s.split('-').map(Number);
  const leap=year%400===0||(year%4===0&&year%100!==0);
  const days=[0,31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month];
}
export function validateEmployee(i:EmployeeInput):void {
  if(!i.emp_code.trim()||!i.full_name.trim()||!len(i.emp_code,20)||!len(i.full_name,120)||!len(i.father_name,120)||!len(i.job_title,80)||!len(i.phone,40)||!len(i.tazkira_no,40)||!len(i.address,255)||!len(i.contract_duration,60)||!len(i.notes,10000)||!['active','inactive'].includes(i.status))throw new Error('کد، نام، وضعیت یا طول فیلدهای کارمند معتبر نیست.');
  if(!validDate(i.hire_date))throw new Error('تاریخ استخدام میلادی معتبر نیست.');
  if(!/^(?:0|[1-9]\d*|-[1-9]\d*)$/.test(i.base_salary_minor)||BigInt(i.base_salary_minor)>max||BigInt(i.base_salary_minor)<-max)throw new Error('معاش ثابت معتبر نیست یا از محدودهٔ مجاز بیرون است.');
}
