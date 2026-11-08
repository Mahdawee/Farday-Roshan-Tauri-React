import { describe, expect, it } from 'vitest';
import { displayCalendarDate, parseCalendarDate, todayKabul } from '../src/calendar';

describe('calendar conversion and validation', () => {
  it('accepts Dari and Arabic digits and converts Nowruz', () => {
    expect(parseCalendarDate('۱۴۰۴/۰۱/۰۱', 'shamsi')).toBe('2025-03-21');
    expect(parseCalendarDate('١٤٠٣/١٢/٣٠', 'shamsi')).toBe('2025-03-20');
    expect(displayCalendarDate('2025-03-21', 'shamsi')).toBe('1404/01/01');
  });
  it('rejects invalid leap days, months, separators and years', () => {
    for (const date of ['1404/12/30', '1405/13/01', '1405/07/31', '1405-01/01', '0000/01/01', '3178/01/01']) {
      expect(parseCalendarDate(date, 'shamsi'), date).toBeNull();
    }
    expect(parseCalendarDate('2024/02/29', 'miladi')).toBe('2024-02-29');
    expect(parseCalendarDate('2025/02/29', 'miladi')).toBeNull();
    expect(parseCalendarDate('1900/02/29', 'miladi')).toBeNull();
    expect(parseCalendarDate('2000/02/29', 'miladi')).toBe('2000-02-29');
    expect(parseCalendarDate('2026/04/31', 'miladi')).toBeNull();
  });
  it('round trips valid dates at month and year boundaries', () => {
    for (let year = 1300; year <= 1500; year++) {
      for (const month of [1, 6, 7, 12]) {
        for (const day of [1, 29, 30, 31]) {
          const date = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
          const converted = parseCalendarDate(date, 'shamsi');
          if (converted) expect(displayCalendarDate(converted, 'shamsi')).toBe(date);
        }
      }
    }
  });
  it('labels unsupported Gregorian values instead of pretending they are Shamsi', () => {
    expect(displayCalendarDate('9999-12-31', 'shamsi')).toBe('9999-12-31 (میلادی)');
  });
  it('uses Kabul local date rather than the host time zone', () => {
    expect(todayKabul(new Date('2026-03-20T19:20:00Z'))).toBe('2026-03-20');
    expect(todayKabul(new Date('2026-03-20T19:30:00Z'))).toBe('2026-03-21');
  });
});
