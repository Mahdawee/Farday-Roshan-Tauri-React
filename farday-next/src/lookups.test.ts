import {describe,it,expect} from 'vitest';
import {blankLookup,validateLookup} from './lookups';
import type {LookupKind} from './lookups';
import {createLookupPreviewStore} from './lookupStore';

describe('lookup validation',()=>{it('checks domain-specific attributes and integer order',()=>{
  expect(()=>validateLookup('material',{...blankLookup('material'),name:'ریگ',unit:''})).toThrow();
  expect(()=>validateLookup('expense',{...blankLookup('expense'),name:'مصرف',affects_balance:true})).toThrow();
  expect(()=>validateLookup('payer',{...blankLookup('payer'),name:'الف',payer_kind:'other' as never})).toThrow();
  expect(()=>validateLookup('receipt_source',{...blankLookup('receipt_source'),name:'الف',affects_balance:null})).toThrow();
  expect(()=>validateLookup('expense',{...blankLookup('expense'),name:'الف',sort_order:2147483648})).toThrow();
  expect(()=>validateLookup('unknown' as never,{...blankLookup('expense'),name:'الف'})).toThrow();
});});
describe('lookup preview',()=>{it('separates kinds, preserves attributes and rejects duplicate or stale writes',async()=>{
  const s=createLookupPreviewStore();for(const kind of ['material','expense','payer','receipt_source'] as LookupKind[]){
    const input={...blankLookup(kind),name:'Example',sort_order:-5};await s.save(kind,null,null,input);
    await expect(s.save(kind,null,null,{...input,name:'example'})).rejects.toThrow('تکراری');const row=(await s.list(kind))[0];expect(row).toMatchObject(input);
    await s.save(kind,row.id,row.revision,{...input,active:false});await expect(s.delete(kind,row.id,row.revision)).rejects.toThrow();
    const current=(await s.list(kind))[0];expect(current.active).toBe(false);await s.delete(kind,current.id,current.revision);expect(await s.list(kind)).toHaveLength(0);
  }expect(await createLookupPreviewStore().list('material')).toHaveLength(0);
});});
