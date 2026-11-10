import type {Sale} from './sales';
export const previewSales=new Map<string,Sale>();
export const previewSalesCounters=new Map<number,number>();
export const customerHasSales=(id:string)=>Array.from(previewSales.values()).some(s=>s.customer_id===id);
export const materialHasSales=(id:string)=>Array.from(previewSales.values()).some(s=>s.material_id===id);
