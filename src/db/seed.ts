import type { FinancialAccount, TransactionCategory, UserSettings } from '@/types';
import { nowISO } from '@/utils/id';

export const DEFAULT_ACCOUNT_ID = 'acc-cash';
export const SETTINGS_ID = 'main';

const EXPENSE: Array<[string, string, string, string]> = [
  ['exp-housing', 'Yaşayış', '#3565CE', 'home'],
  ['exp-food', 'Qida', '#37C78B', 'utensils'],
  ['exp-transport', 'Nəqliyyat', '#8B7CF6', 'car'],
  ['exp-family', 'Ailə', '#F06464', 'users'],
  ['exp-health', 'Sağlamlıq', '#2BB5C9', 'heart'],
  ['exp-shopping', 'Alış-veriş', '#F4B84C', 'shopping'],
  ['exp-fun', 'Əyləncə', '#E879B9', 'smile'],
  ['exp-education', 'Təhsil', '#5B8DEF', 'book'],
  ['exp-other', 'Digər', '#9AA7BD', 'more'],
];

const INCOME: Array<[string, string, string, string]> = [
  ['inc-salary', 'Maaş', '#37C78B', 'wallet'],
  ['inc-bonus', 'Bonus', '#3565CE', 'gift'],
  ['inc-extra', 'Əlavə gəlir', '#8B7CF6', 'plus'],
  ['inc-invest', 'İnvestisiya', '#F4B84C', 'trending'],
  ['inc-other', 'Digər', '#9AA7BD', 'more'],
];

export function buildSeedRecords() {
  const ts = nowISO();
  const mk = (type: 'income' | 'expense') => (row: [string, string, string, string], i: number): TransactionCategory => ({
    id: row[0],
    name: row[1],
    color: row[2],
    icon: row[3],
    type,
    isDefault: true,
    sort: i,
    createdAt: ts,
    updatedAt: ts,
  });

  const categories = [...EXPENSE.map(mk('expense')), ...INCOME.map(mk('income'))];

  const accounts: FinancialAccount[] = [
    { id: DEFAULT_ACCOUNT_ID, name: 'Əsas hesab', type: 'cash', currency: 'AZN', createdAt: ts, updatedAt: ts },
  ];

  const settings: UserSettings = {
    id: SETTINGS_ID,
    name: 'Elxan',
    email: '',
    theme: 'system',
    currency: 'AZN',
    createdAt: ts,
    updatedAt: ts,
  };

  return { categories, accounts, settings };
}
