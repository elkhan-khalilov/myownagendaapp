'use client';
import { create } from 'zustand';
import type { NoteCategory, TransactionType } from '@/types';

export type SheetState =
  | {
      type: 'task';
      id?: string;
      kind?: 'task' | 'meeting';
      date?: string;
      /** Prefill for new items (e.g. note → task conversion) */
      prefill?: { title?: string; description?: string };
    }
  | { type: 'transaction'; id?: string; txType?: TransactionType }
  | { type: 'note'; id?: string; category?: NoteCategory }
  | { type: 'reminders' }
  | null;

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void;
  tone?: 'default' | 'error' | 'warn';
  sticky?: boolean;
}

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIState {
  quickAddOpen: boolean;
  setQuickAdd: (open: boolean) => void;
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  toast: Toast | null;
  showToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: () => void;
  confirm: ConfirmRequest | null;
  setConfirm: (c: ConfirmRequest | null) => void;
  refreshTick: number;
  refresh: () => void;
}

export const useUI = create<UIState>((set) => ({
  quickAddOpen: false,
  setQuickAdd: (quickAddOpen) => set({ quickAddOpen }),
  sheet: null,
  openSheet: (sheet) => set({ sheet, quickAddOpen: false }),
  closeSheet: () => set({ sheet: null }),
  toast: null,
  showToast: (t) => set({ toast: { ...t, id: Date.now() } }),
  dismissToast: () => set({ toast: null }),
  confirm: null,
  setConfirm: (confirm) => set({ confirm }),
  refreshTick: 0,
  refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));

/** Show an undo toast after a deletion */
export function undoToast(message: string, undo: () => Promise<unknown>) {
  useUI.getState().showToast({ message, actionLabel: 'Geri qaytar', action: () => void undo() });
}

/** In-app confirmation dialog (replaces window.confirm, which is unreliable in iOS standalone mode). */
export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.getState().setConfirm({ ...opts, resolve });
  });
}
