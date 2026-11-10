import {describe,it,expect} from 'vitest';
import vectors from '../contracts/financial-arithmetic.tsv?raw';
import {saleTotal,salaryTotal} from './financial';
describe('exact financial arithmetic (not accounting-approved)',()=>{
  it('matches shared decimal reference vectors',()=>{for(const line of vectors.split('\n')){if(!line||line.startsWith('#'))continue;const p=line.split('\t');if(p[0]==='S')expect(saleTotal(p[1],p[2],p[3])).toBe(p[4]);else if(p[0]==='P')expect(salaryTotal(p[1],p[2],p[3],p[4])).toBe(p[5]);else throw new Error('bad vector');}});
  it('rejects noncanonical numbers, range and total overflow',()=>{for(const s of ['', '-0','01','+1',' 1','1.1','1e2','١','999999999999999999999999'])expect(()=>saleTotal(s,'0','0')).toThrow();expect(()=>saleTotal('1000000000000','1','0')).toThrow();expect(()=>salaryTotal('100000000000000','0','0','0')).toThrow();expect(()=>saleTotal('999999999999','99999999999999','99999999999999')).toThrow();});
});
