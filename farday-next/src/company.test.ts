import {describe,it,expect} from 'vitest';
import {blankMachine,initialCompany,integer,validateCompany,validateMachine} from './company';
import {createPreviewStore} from './store';

describe('company validation',()=>{
  it('accepts Persian and Arabic digits but rejects non-integers',()=>{expect(integer(' -۱۲٣ ')).toBe(-123);expect(integer('')).toBeNaN();expect(integer('1.5')).toBeNaN();expect(integer('1e3')).toBeNaN();});
  it('checks required, range and statuses',()=>{expect(()=>validateCompany({...initialCompany,name:'  '})).toThrow();expect(()=>validateCompany({...initialCompany,employees_count:2.5})).toThrow();expect(()=>validateMachine({...blankMachine,name:'ل',count:0})).toThrow();expect(()=>validateMachine({...blankMachine,name:'ل',status:'unknown' as never})).toThrow();});
});
describe('memory-only preview',()=>{
  it('saves, updates, rejects stale revisions and deletes',async()=>{const s=createPreviewStore();const first=await s.snapshot();await s.saveCompany({...first.company,name:' شرکت جدید '},first.company.revision);await expect(s.saveCompany(first.company,first.company.revision)).rejects.toThrow();expect((await s.snapshot()).company.name).toBe('شرکت جدید');await s.saveMachine(null,null,{...blankMachine,name:'لودر'});const m=(await s.snapshot()).machines[0];await s.saveMachine(m.id,m.revision,{...m,status:'repair'});await expect(s.deleteMachine(m.id,m.revision)).rejects.toThrow();const newer=(await s.snapshot()).machines[0];expect(newer.status).toBe('repair');await s.deleteMachine(newer.id,newer.revision);expect((await s.snapshot()).machines).toHaveLength(0);expect((await createPreviewStore().snapshot()).machines).toHaveLength(0);});
});
