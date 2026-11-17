'use client';
import { create } from 'zustand';

export type SyncPhase = 'disabled' | 'idle' | 'syncing' | 'offline' | 'error' | 'signed_out' | 'not_configured';

interface SyncStore {
  phase: SyncPhase;
  enabled: boolean;
  lastSyncAt?: string;
  error?: string;
  set: (p: Partial<Omit<SyncStore, 'set'>>) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  phase: 'disabled',
  enabled: false,
  set: (p) => set(p),
}));
