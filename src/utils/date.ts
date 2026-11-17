import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];
export const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
/** Monday-first short weekday names */
export const WEEKDAYS_SHORT = ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'];
export const WEEKDAYS_LONG = ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'];

/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromKey = (k: string) => parseISO(k);
export const todayKey = () => toKey(new Date());
export const monthKey = (d: Date) => format(d, 'yyyy-MM');

/** "16 Noyabr, B.e." */
export function formatHeaderDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEKDAYS_SHORT[weekdayIndex(d)]}`;
}

/** "14 Noyabr" (+ year if not current) */
export function formatDayMonth(key: string) {
  const d = fromKey(key);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatMonthYear(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function durationLabel(start?: string, end?: string): string {
  if (!start || !end) return '';
  const mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) return '';
  if (mins < 60) return `${mins} dəq`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} saat ${m} dəq` : `${h} saat`;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function relativeUpdated(iso: string) {
  return formatDayMonth(toKey(new Date(iso)));
}
