'use client';
import { Bell, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, EmptyState } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { useMeetings, useTasks } from '@/hooks/useData';
import { useNow } from '@/hooks/useNow';
import { dueReminders, occurrencesOn } from '@/services/recurrence';
import { useUI } from '@/stores/ui';
import { toKey } from '@/utils/date';

export function RemindersSheet() {
  const { sheet, closeSheet, openSheet } = useUI();
  const open = sheet?.type === 'reminders';
  const tasks = useTasks();
  const meetings = useMeetings();
  const now = useNow();
  const due = dueReminders(tasks, meetings, now);
  const withReminders = occurrencesOn(tasks, meetings, toKey(now)).filter(
    (o) => !o.done && o.reminderMinutes !== null && o.startTime,
  );
  const [perm, setPerm] = useState<string>('unsupported');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setPerm(Notification.permission);
  }, [open]);

  return (
    <Sheet open={open} onClose={closeSheet} title="Xatırlatmalar">
      <div className="space-y-3 pt-1">
        {due.length > 0 && (
          <div className="rounded-2xl bg-p-yellow p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#B9811A]">
              <BellRing size={16} /> İndi vaxtıdır
            </p>
            {due.map((o) => (
              <p key={o.kind + o.id} className="text-[15px] font-medium">
                {o.startTime} · {o.title}
              </p>
            ))}
          </div>
        )}
        {withReminders.length === 0 ? (
          <EmptyState icon={<Bell />} title="Bu gün xatırlatma yoxdur" text="Tapşırıq və görüşlərə xatırlatma əlavə edə bilərsiniz." />
        ) : (
          withReminders.map((o) => (
            <button
              key={o.kind + o.id}
              onClick={() => openSheet({ type: 'task', id: o.id, kind: o.kind })}
              className="flex w-full items-center justify-between rounded-2xl bg-bg px-4 py-3 text-left"
            >
              <span className="font-medium">{o.title}</span>
              <span className="text-sm text-muted">
                {o.startTime} · {o.reminderMinutes === 0 ? 'başlayanda' : `${o.reminderMinutes} dəq əvvəl`}
              </span>
            </button>
          ))
        )}
        <div className="rounded-2xl border border-line p-4 text-sm text-muted">
          <p>
            Xatırlatmalar tətbiq açıq olanda göstərilir. Tətbiq bağlı olanda planlaşdırılmış bildiriş üçün push serveri
            lazımdır — bu, backend mərhələsində əlavə olunacaq.
          </p>
          {perm === 'default' && (
            <Button
              variant="soft"
              className="mt-3 w-full"
              onClick={async () => setPerm(await Notification.requestPermission())}
            >
              Sistem bildirişlərinə icazə ver
            </Button>
          )}
          {perm === 'granted' && <p className="mt-2 font-medium text-income">Sistem bildirişləri aktivdir (tətbiq açıq olanda).</p>}
          {perm === 'unsupported' && (
            <p className="mt-2">iPhone-da sistem bildirişləri yalnız Ana ekrana əlavə olunmuş tətbiqdə (iOS 16.4+) mövcuddur.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
