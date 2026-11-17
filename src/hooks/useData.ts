'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/db/schema';
import { SETTINGS_ID } from '@/db/seed';
import type { UserSettings } from '@/types';

const EMPTY: never[] = [];

export const useTasks = () => useLiveQuery(() => getDB().tasks.toArray(), []) ?? EMPTY;
export const useMeetings = () => useLiveQuery(() => getDB().meetings.toArray(), []) ?? EMPTY;
export const useNotes = () => useLiveQuery(() => getDB().notes.toArray(), []);
export const useTransactions = () => useLiveQuery(() => getDB().transactions.toArray(), []) ?? EMPTY;
export const useCategories = () =>
  useLiveQuery(() => getDB().transactionCategories.orderBy('sort').toArray(), []) ?? EMPTY;
export const useBudgets = () => useLiveQuery(() => getDB().budgets.toArray(), []) ?? EMPTY;

const DEFAULT_SETTINGS: UserSettings = {
  id: SETTINGS_ID,
  name: 'Elxan',
  email: '',
  theme: 'system',
  currency: 'AZN',
  createdAt: '',
  updatedAt: '',
};

export const useSettings = (): UserSettings =>
  useLiveQuery(() => getDB().userSettings.get(SETTINGS_ID), []) ?? DEFAULT_SETTINGS;
