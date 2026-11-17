import type { Currency } from '@/types';

export const CURRENCY_SYMBOL: Record<Currency, string> = { AZN: '₼', USD: '$', EUR: '€' };

const NBSP = ' ';

/**
 * Parse a user-entered amount ("12,50", "12.5", "1 250") into integer minor units.
 * Returns null for invalid / non-positive input. Never uses floating point.
 */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (whole.length > 12) return null;
  const minor = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return minor > 0 ? minor : null;
}

/** Integer minor units → editable string ("12,50" / "1850") */
export function minorToInput(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100);
  return frac ? `${whole},${String(frac).padStart(2, '0')}` : String(whole);
}

interface FormatOpts {
  currency?: Currency;
  sign?: boolean; // show + for positive
  compact?: boolean; // 4.5k style for chart axes
}

/** Format integer minor units in Azerbaijani style: "1 850 ₼", "12,50 ₼" */
export function formatMoney(minor: number, opts: FormatOpts = {}): string {
  const { currency = 'AZN', sign = false } = opts;
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const num = frac ? `${grouped},${String(frac).padStart(2, '0')}` : grouped;
  const prefix = neg ? '−' : sign && minor > 0 ? '+' : '';
  return `${prefix}${num}${NBSP}${CURRENCY_SYMBOL[currency]}`;
}

export function formatCompact(minor: number): string {
  const whole = Math.round(minor / 100);
  if (Math.abs(whole) >= 1000) {
    const k = Math.round(whole / 100) / 10;
    return `${String(k).replace('.', ',')}k`;
  }
  return String(whole);
}

/** Integer percent (0..∞) of part/total, rounded half up */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((part * 100 + Math.floor(total / 2)) / total);
}

/**
 * Split 100% across values with the largest-remainder method so percentages sum exactly to 100.
 */
export function distributePercents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v * 100) / total);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
}
