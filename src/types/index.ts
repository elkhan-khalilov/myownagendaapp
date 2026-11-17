export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type Priority = 'low' | 'medium' | 'high';
export type TaskCategory = 'general' | 'important' | 'presentation' | 'personal' | 'exercise';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type ItemStatus = 'pending' | 'done' | 'cancelled';

/** Minutes before start; null = no reminder */
export type ReminderMinutes = number | null;

interface ScheduledBase extends BaseRecord {
  title: string;
  description?: string;
  date: string; // yyyy-MM-dd (first occurrence)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  reminderMinutes: ReminderMinutes;
  repeat: Repeat;
  repeatUntil?: string; // yyyy-MM-dd
  status: ItemStatus;
  /** For recurring items: dates (yyyy-MM-dd) on which the occurrence was completed */
  completedDates: string[];
}

export interface Task extends ScheduledBase {
  priority: Priority;
  category: TaskCategory;
}

export interface Meeting extends ScheduledBase {
  location?: string;
  startTime: string;
  endTime: string;
}

export type NoteCategory = 'work' | 'idea' | 'personal';

export interface Note extends BaseRecord {
  title: string;
  body: string;
  category: NoteCategory;
  pinned: boolean;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction extends BaseRecord {
  type: TransactionType;
  /** Amount in minor units (qəpik). Always a positive integer. */
  amount: number;
  categoryId: ID;
  accountId: ID;
  date: string; // yyyy-MM-dd
  note?: string;
}

export interface TransactionCategory extends BaseRecord {
  type: TransactionType;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  sort: number;
}

export const TOTAL_BUDGET_KEY = '__total__';

export interface Budget extends BaseRecord {
  /** Category id, or TOTAL_BUDGET_KEY for the overall monthly limit */
  categoryId: string;
  /** Monthly limit in minor units */
  limit: number;
}

export interface FinancialAccount extends BaseRecord {
  name: string;
  type: 'cash' | 'card' | 'bank';
  currency: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type Currency = 'AZN' | 'USD' | 'EUR';

export interface UserSettings extends BaseRecord {
  name: string;
  email?: string;
  theme: ThemeMode;
  currency: Currency;
  /** ISO timestamp of the last successful export */
  lastBackupAt?: string;
  /** Quick-entry memory of the last used categories */
  lastExpenseCategoryId?: string;
  lastIncomeCategoryId?: string;
}

/** A concrete occurrence of a task or meeting on a specific date */
export interface AgendaOccurrence {
  kind: 'task' | 'meeting';
  id: ID;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  colorKey: 'blue' | 'red' | 'purple' | 'green' | 'yellow';
  done: boolean;
  recurring: boolean;
  reminderMinutes: ReminderMinutes;
  priority?: Priority;
}
