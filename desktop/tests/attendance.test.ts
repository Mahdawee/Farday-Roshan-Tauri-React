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
