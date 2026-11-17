'use client';
import { MotionConfig } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { NoteEditorSheet } from '@/components/forms/NoteEditor';
import { RemindersSheet } from '@/components/forms/RemindersSheet';
import { TaskFormSheet } from '@/components/forms/TaskForm';
import { TransactionFormSheet } from '@/components/forms/TransactionForm';
import { BottomNav } from '@/components/navigation/BottomNav';
import { QuickAddSheet } from '@/components/navigation/QuickAddSheet';
import { ToastHost } from '@/components/ui/Toast';
import { ConfirmHost } from '@/components/ui/ConfirmDialog';
import { DbGate } from './DbGate';
import { useOnline } from '@/hooks/useOnline';
import { WifiOff } from 'lucide-react';
import { useMeetings, useSettings, useTasks } from '@/hooks/useData';
import { useNow } from '@/hooks/useNow';
import { registerServiceWorker } from '@/pwa/register';
import { initSync } from '@/services/sync';
import { dueReminders } from '@/services/recurrence';
import { useUI } from '@/stores/ui';

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem('myagenda-theme', theme); // UI preference only, no user data
      } catch {}
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** In-app reminders: shows a toast (and a system notification if permitted) once per occurrence. */
function useReminderTicker() {
  const tasks = useTasks();
  const meetings = useMeetings();
  const now = useNow(30_000);
  // Remember shown reminders for this session so reloads/navigations don't repeat them
  const shown = useRef<Set<string>>(
    new Set(
      (() => {
        try {
          return JSON.parse(sessionStorage.getItem('myagenda-shown-reminders') ?? '[]') as string[];
        } catch {
          return [];
        }
      })(),
    ),
  );
  useEffect(() => {
    for (const o of dueReminders(tasks, meetings, now)) {
      const key = `${o.kind}:${o.id}:${o.date}`;
      if (shown.current.has(key)) continue;
      shown.current.add(key);
      try {
        sessionStorage.setItem('myagenda-shown-reminders', JSON.stringify([...shown.current].slice(-200)));
      } catch {}
      const msg = `⏰ ${o.startTime} — ${o.title}`;
      useUI.getState().showToast({ message: msg, tone: 'warn' });
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('MyAgenda', { body: msg, tag: key });
        } catch {}
      }
    }
  }, [tasks, meetings, now]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname.startsWith('/settings');
  const online = useOnline();
  useTheme();
  useReminderTicker();

  useEffect(() => {
    void registerServiceWorker((apply) =>
      useUI.getState().showToast({ message: 'Yeni versiya hazırdır', actionLabel: 'Yenilə', action: apply, sticky: true }),
    );
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initSync()
      .then((c) => (cleanup = c))
      .catch(() => console.warn('[sync] init failed'));
    return () => cleanup?.();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[480px] overflow-x-hidden">
        {!online && (
          <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-navy-deep px-4 pb-1.5 pt-[calc(env(safe-area-inset-top)+6px)] text-[12.5px] text-white">
            <WifiOff size={14} /> Oflayn rejim — məlumatlar cihazda saxlanılır
          </div>
        )}
        <main className={hideNav ? '' : 'pb-[calc(84px+env(safe-area-inset-bottom))]'}>
          <DbGate>{children}</DbGate>
        </main>
      </div>
      {!hideNav && <BottomNav />}
      <QuickAddSheet />
      <TaskFormSheet />
      <TransactionFormSheet />
      <NoteEditorSheet />
      <RemindersSheet />
      <ToastHost />
      <ConfirmHost />
    </MotionConfig>
  );
}
