import Dexie, { type Table } from 'dexie';
import type {
  Budget,
  FinancialAccount,
  Meeting,
  Note,
  Task,
  Transaction,
  TransactionCategory,
  UserSettings,
} from '@/types';
import { buildSeedRecords } from './seed';

export const DB_NAME = 'myagenda';

export class MyAgendaDB extends Dexie {
  tasks!: Table<Task, string>;
  meetings!: Table<Meeting, string>;
  notes!: Table<Note, string>;
  transactions!: Table<Transaction, string>;
  transactionCategories!: Table<TransactionCategory, string>;
  budgets!: Table<Budget, string>;
  financialAccounts!: Table<FinancialAccount, string>;
  userSettings!: Table<UserSettings, string>;

  constructor(name = DB_NAME) {
    super(name);

    // v1 — initial schema
    this.version(1).stores({
      tasks: 'id, date, status, category, updatedAt',
      meetings: 'id, date, status, updatedAt',
      notes: 'id, category, pinned, updatedAt',
      transactions: 'id, date, type, categoryId, updatedAt',
      transactionCategories: 'id, type, sort',
      budgets: 'id, categoryId',
      financialAccounts: 'id',
      userSettings: 'id',
    });

    // v2 — add repeat index for recurring lookups; backfill completedDates
    this.version(2)
      .stores({
        tasks: 'id, date, status, category, repeat, updatedAt',
        meetings: 'id, date, status, repeat, updatedAt',
      })
      .upgrade(async (tx) => {
        for (const table of ['tasks', 'meetings'] as const) {
          await tx
            .table(table)
            .toCollection()
            .modify((r: Task | Meeting) => {
              if (!Array.isArray(r.completedDates)) r.completedDates = [];
              if (!r.repeat) r.repeat = 'none';
            });
        }
      });

    this.on('populate', async (tx) => {
      const seed = buildSeedRecords();
      await tx.table('transactionCategories').bulkAdd(seed.categories);
      await tx.table('financialAccounts').bulkAdd(seed.accounts);
      await tx.table('userSettings').add(seed.settings);
    });
  }
}

let instance: MyAgendaDB | null = null;

export function getDB(): MyAgendaDB {
  if (!instance) instance = new MyAgendaDB();
  return instance;
}

/** Test helper — swap the DB instance */
export function setDB(db: MyAgendaDB | null) {
  instance = db;
}
