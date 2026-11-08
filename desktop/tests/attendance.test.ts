import { describe, it, expect } from 'vitest';
import { Attendance } from '../src/domain';
import { summarizeAttendance } from '../src/attendance';
const first: Attendance={id:'a',employee_id:'e1',employee_name:'کارمند',employee_code:'E1',work_date:'2025-03-21',status:'present',check_in:'08:00',check_out:null,overtime:'1.25',notes:''};
const rows: Attendance[]=[first,{...first,id:'b',employee_id:'e2',work_date:'2025-03-22',status:'absent',overtime:'0.50'}];
describe('attendance filters and recorded-day summaries',()=>{
  it('filters inclusive dates, employee and status without inventing days',()=>{
    const all=summarizeAttendance(rows,'','','','shamsi','','');
    expect(all.counts.present).toBe(1); expect(all.counts.absent).toBe(1); expect(all.overtime).toBe('1.75');
    const one=summarizeAttendance(rows,'','۱۴۰۴/۰۱/۰۲','۱۴۰۴/۰۱/۰۲','shamsi','e2','absent');
    expect(one.rows).toHaveLength(1); expect(one.counts.absent).toBe(1); expect(one.counts.present).toBe(0); expect(one.overtime).toBe('0.50');
  });
  it('does not produce summaries for invalid or reversed dates',()=>{
    expect(()=>summarizeAttendance(rows,'','1404/12/30','','shamsi','','')).toThrow();
    expect(()=>summarizeAttendance(rows,'','2025/03/22','2025/03/21','miladi','','')).toThrow();
  });
});

it('monthly report respects Shamsi and Gregorian month boundaries, including leap days',async()=>{
  const {monthlyAttendance}=await import('../src/attendance');
  const staff=[{id:'e1',code:'E1',name:'اول',father_name:'',job_title:'',hire_date:null,base_salary:'0.00',phone:'',status:'active' as const},{id:'e2',code:'E2',name:'دوم',father_name:'',job_title:'',hire_date:null,base_salary:'0.00',phone:'',status:'inactive' as const}];
  const data=[...rows,{...first,id:'c',work_date:'2025-04-20',status:'leave' as const},{...first,id:'d',work_date:'2025-04-21',status:'sick' as const}];
  const report=monthlyAttendance(data,staff,'۱۴۰۴/۰۱','shamsi');
  expect([report.from,report.to]).toEqual(['2025-03-21','2025-04-20']);
  expect(report.rows[0].recorded).toBe(2); expect(report.rows[0].counts.leave).toBe(1); expect(report.rows[1].counts.absent).toBe(1);
  expect(monthlyAttendance([],staff,'2024/02','miladi').to).toBe('2024-02-29');
  expect(monthlyAttendance([],staff,'1403/12','shamsi').to).toBe('2025-03-20');
  expect(()=>monthlyAttendance(data,staff,'1404/13','shamsi')).toThrow();
});
