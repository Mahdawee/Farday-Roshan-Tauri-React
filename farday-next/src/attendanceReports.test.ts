import {describe,it,expect} from 'vitest';
import {daysInMonth,validateRange} from './attendance';
import type {AttendanceEntry,AttendanceStatus} from './attendance';
import {createAttendancePreviewStore} from './attendanceStore';
import {createEmployeePreviewStore} from './employeeStore';
import {blankEmployee} from './employees';

describe('Gregorian reports',()=>{
  it('checks leap years, invalid months and inclusive range limit',()=>{expect(daysInMonth(2024,2)).toBe(29);expect(daysInMonth(1900,2)).toBe(28);expect(daysInMonth(2000,2)).toBe(29);expect(daysInMonth(9999,12)).toBe(31);expect(()=>daysInMonth(0,1)).toThrow();expect(()=>daysInMonth(2024,13)).toThrow();expect(()=>validateRange('2024-03-01','2024-02-01')).toThrow();expect(()=>validateRange('2000-01-01','2020-01-01')).toThrow();expect(()=>validateRange('2024-02-29','2024-02-29')).not.toThrow();expect(()=>validateRange('2023-02-29','2024-02-29')).toThrow();});
  it('includes unrecorded employees in month but excludes them from summary',async()=>{const staff=createEmployeePreviewStore();const store=createAttendancePreviewStore(staff);await staff.save(null,null,{...blankEmployee,emp_code:'E1',full_name:'احمد'});await staff.save(null,null,{...blankEmployee,emp_code:'E2',full_name:'بهنام'});const [e1]=await staff.list();const statuses:AttendanceStatus[]=['present','absent','leave','sick','holiday','friday'];
    for(let i=0;i<statuses.length;i++){const e:AttendanceEntry={status:statuses[i],check_in:'',check_out:'',overtime_hundredths:i===0?125:10,notes:''};await store.save(`2024-02-0${i+1}`,[{employee_id:e1.id,record_id:null,revision:null,entry:e}]);}
    await staff.save(e1.id,e1.revision,{...e1,status:'inactive'});const month=await store.month(2024,2);expect(month.days).toBe(29);expect(month.rows).toHaveLength(2);expect(month.rows[0].employee_status).toBe('inactive');expect(month.rows[0].cells.filter(c=>!c)).toHaveLength(23);expect(month.rows[1].cells.filter(c=>!c)).toHaveLength(29);
    const rows=await store.summary('2024-02-01','2024-02-06');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({present:1,absent:1,leave_count:1,sick:1,holiday:1,friday:1,overtime_hundredths:'175'});expect((await store.summary('2024-02-02','2024-02-02'))[0]).toMatchObject({absent:1,present:0,overtime_hundredths:'10'});expect(await store.summary('2024-03-01','2024-03-02')).toHaveLength(0);
  });
});
