import { describe, expect, it } from 'vitest';
import { distributePercents, formatMoney, minorToInput, parseMoney, percentOf } from '@/utils/money';

describe('money', () => {
  it('parses user input into integer qəpik without floats', () => {
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('0,1')).toBe(10);
    expect(parseMoney('1 850')).toBe(185000);
    expect(parseMoney('0.29')).toBe(29); // 0.29*100 = 28.999… in float
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1,234')).toBeNull();
    expect(parseMoney('0')).toBeNull();
  });
  it('formats in Azerbaijani style', () => {
    expect(formatMoney(185000)).toBe('1 850 ₼');
    expect(formatMoney(1250)).toBe('12,50 ₼');
    expect(formatMoney(-268000)).toBe('−2 680 ₼');
    expect(formatMoney(185000, { sign: true })).toBe('+1 850 ₼');
    expect(formatMoney(500, { currency: 'USD' })).toBe('5 $');
  });
  it('round-trips input', () => {
    expect(minorToInput(1250)).toBe('12,50');
    expect(parseMoney(minorToInput(99999))).toBe(99999);
  });
  it('percent helpers', () => {
    expect(percentOf(268000, 400000)).toBe(67);
    expect(percentOf(1, 0)).toBe(0);
    const p = distributePercents([1, 1, 1]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
