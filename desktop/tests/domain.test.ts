import { describe, expect, it } from 'vitest';
import { formatScaled, parseScaled, saleTotal } from '../src/domain';
describe('financial arithmetic', () => {
  it('normalizes local digits without floating point', () => {
    expect(parseScaled('۱٬۲۳۴.۵۰', 2)).toBe(123450n);
    expect(formatScaled(-123450n)).toBe('-1234.50');
  });
  it('computes volume times price plus freight, rounded to cents', () => {
    expect(saleTotal('10', '500', '300')).toBe(800000n);
    expect(saleTotal('0.005', '1', '0')).toBe(1n);
  });
  it('rejects malformed, negative, oversized and over-precise values', () => {
    for (const v of ['-1', '1.001', 'abc', '', '100000000000']) expect(() => parseScaled(v, 2)).toThrow();
    expect(() => saleTotal('0', '1', '0')).toThrow();
  });
});
