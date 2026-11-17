'use client';
import { addDays } from 'date-fns';
import { AlertTriangle, CalendarClock, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Segmented, Select, Textarea } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/Sheet';
import { meetingsRepo, tasksRepo } from '@/repositories';
import { findConflicts, validateTimes } from '@/services/recurrence';
import { confirmAction, undoToast, useUI } from '@/stores/ui';
import { useMeetings, useTasks } from '@/hooks/useData';
import { DateQuickPick } from './DateQuickPick';
import { haptic } from '@/utils/haptics';
import type { ItemStatus, Meeting, Priority, Repeat, Task, TaskCategory } from '@/types';
import { fromKey, todayKey, toKey } from '@/utils/date';

interface FormState {
  kind: 'task' | 'meeting';
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  priority: Priority;
  category: TaskCategory;
  reminder: string;
  repeat: Repeat;
  repeatUntil: string;
  status: ItemStatus;
}

const empty = (kind: 'task' | 'meeting', date?: string): FormState => ({
  kind,
  title: '',
  description: '',
  location: '',
  date: date ?? todayKey(),
  startTime: kind === 'meeting' ? '10:00' : '',
  endTime: kind === 'meeting' ? '11:00' : '',
  priority: 'medium',
  category: 'general',
  reminder: kind === 'meeting' ? '15' : '',
  repeat: 'none',
  repeatUntil: '',
  status: 'pending',
});

export function TaskFormSheet() {
  const { sheet, closeSheet, showToast } = useUI();
  const open = sheet?.type === 'task';
  const editId = open ? sheet.id : undefined;
  const [f, setF] = useState<FormState>(empty('task'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    const kind = sheet.kind ?? 'task';
    if (!sheet.id) {
      setF({ ...empty(kind, sheet.date), title: sheet.prefill?.title ?? '', description: sheet.prefill?.description ?? '' });
      return;
    }
    const repo = kind === 'meeting' ? meetingsRepo : tasksRepo;
    repo.get(sheet.id).then((rec) => {
      if (!rec) return;
      const r = rec as Task & Meeting;
      setF({
        kind,
        title: r.title,
        description: r.description ?? '',
        location: r.location ?? '',
        date: r.date,
        startTime: r.startTime ?? '',
        endTime: r.endTime ?? '',
        priority: r.priority ?? 'medium',
        category: r.category ?? 'general',
        reminder: r.reminderMinutes === null || r.reminderMinutes === undefined ? '' : String(r.reminderMinutes),
        repeat: r.repeat ?? 'none',
        repeatUntil: r.repeatUntil ?? '',
        status: r.status,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const tasks = useTasks();
  const meetings = useMeetings();
  const conflicts = open && f.date ? findConflicts(tasks, meetings, f.date, f.startTime || undefined, f.endTime || undefined, editId) : [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Başlıq tələb olunur';
    if (!f.date) e.date = 'Tarix seçin';
    if (f.kind === 'meeting' && (!f.startTime || !f.endTime)) e.time = 'Görüş üçün başlama və bitmə vaxtı lazımdır';
    const t = validateTimes(f.startTime || undefined, f.endTime || undefined);
    if (t) e.time = t;
    if (f.reminder && !f.startTime) e.reminder = 'Xatırlatma üçün başlama vaxtı lazımdır';
    if (f.repeat !== 'none' && f.repeatUntil && f.repeatUntil < f.date) e.repeatUntil = 'Bitmə tarixi başlanğıcdan əvvəl ola bilməz';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const common = {
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      date: f.date,
      startTime: f.startTime || undefined,
      endTime: f.endTime || undefined,
      reminderMinutes: f.reminder === '' ? null : Number(f.reminder),
      repeat: f.repeat,
      repeatUntil: f.repeat !== 'none' && f.repeatUntil ? f.repeatUntil : undefined,
      status: f.status,
    };
    try {
      if (f.kind === 'task') {
        const data = { ...common, priority: f.priority, category: f.category };
        if (editId) await tasksRepo.update(editId, data);
        else await tasksRepo.create({ ...data, completedDates: [] } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
      } else {
        const data = { ...common, startTime: f.startTime, endTime: f.endTime, location: f.location.trim() || undefined };
        if (editId) await meetingsRepo.update(editId, data);
        else await meetingsRepo.create({ ...data, completedDates: [] } as Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>);
      }
      haptic('success');
      showToast({ message: editId ? 'Yadda saxlanıldı' : f.kind === 'task' ? 'Tapşırıq əlavə edildi' : 'Görüş əlavə edildi' });
      closeSheet();
    } catch (e) {
      showToast({ message: (e as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editId) return;
    const ok = await confirmAction({
      title: f.kind === 'task' ? 'Tapşırıq silinsin?' : 'Görüş silinsin?',
      message: f.repeat !== 'none' ? 'Bu, bütün təkrarlanan hadisələri siləcək.' : undefined,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    const repo = f.kind === 'task' ? tasksRepo : meetingsRepo;
    const rec = await repo.remove(editId);
    closeSheet();
    if (rec) undoToast(f.kind === 'task' ? 'Tapşırıq silindi' : 'Görüş silindi', () => repo.restore(rec as never));
  }

  function moveToTomorrow() {
    set('date', toKey(addDays(fromKey(f.date || todayKey()), 1)));
  }

  const isMeeting = f.kind === 'meeting';
  const title = editId ? (isMeeting ? 'Görüşü redaktə et' : 'Tapşırığı redaktə et') : isMeeting ? 'Yeni görüş' : 'Yeni tapşırıq';

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={title}
      footer={
        <div className="flex gap-3">
          {editId && (
            <Button variant="danger" onClick={remove} aria-label="Sil" className="w-12 px-0">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={saving}>
            Yadda saxla
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {!editId && (
          <Segmented
            value={f.kind}
            onChange={(k) => setF((p) => ({ ...empty(k, p.date), title: p.title, description: p.description }))}
            options={[
              { value: 'task', label: 'Tapşırıq' },
              { value: 'meeting', label: 'Görüş' },
            ]}
          />
        )}
        <Field label="Başlıq" error={errors.title}>
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={isMeeting ? 'Məs. Komanda standup' : 'Məs. Hesabatı hazırlamaq'} enterKeyHint="done" maxLength={200} />
        </Field>
        <Field label="Təsvir">
          <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Əlavə qeyd (istəyə bağlı)" maxLength={5000} />
        </Field>
        {isMeeting && (
          <Field label="Məkan">
            <Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Məs. Konfrans zalı" maxLength={200} />
          </Field>
        )}
        <Field label="Tarix" error={errors.date}>
          <div className="flex gap-2">
            <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className="flex-1" />
            {editId && (
              <Button type="button" variant="soft" onClick={moveToTomorrow} className="shrink-0 px-3 text-[13px]" aria-label="Bir gün sonraya keçir">
                <CalendarClock size={16} /> +1 gün
              </Button>
            )}
          </div>
          <DateQuickPick value={f.date} onChange={(d) => set('date', d)} />
        </Field>
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlama">
              <Input type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
            <Field label="Bitmə">
              <Input type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          </div>
          {errors.time && <p role="alert" className="mt-1 text-xs font-medium text-expense">{errors.time}</p>}
          {conflicts.length > 0 && !errors.time && (
            <div role="status" className="mt-2 flex gap-2 rounded-2xl bg-p-yellow p-3 text-[13px]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#C98A16]" />
              <span>
                Vaxt üst-üstə düşür:{' '}
                {conflicts.map((c) => `${c.title} (${c.startTime}${c.endTime ? '–' + c.endTime : ''})`).join(', ')}. Yenə də saxlaya bilərsiniz.
              </span>
            </div>
          )}
        </div>
        {!isMeeting && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioritet">
              <Select value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                <option value="low">Aşağı</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksək</option>
              </Select>
            </Field>
            <Field label="Kateqoriya">
              <Select value={f.category} onChange={(e) => set('category', e.target.value as TaskCategory)}>
                <option value="general">Ümumi</option>
                <option value="important">Vacib</option>
                <option value="presentation">Təqdimat</option>
                <option value="personal">Şəxsi</option>
                <option value="exercise">İdman</option>
              </Select>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Xatırlatma" error={errors.reminder}>
            <Select value={f.reminder} onChange={(e) => set('reminder', e.target.value)}>
              <option value="">Yoxdur</option>
              <option value="0">Başlayanda</option>
              <option value="5">5 dəq əvvəl</option>
              <option value="15">15 dəq əvvəl</option>
              <option value="30">30 dəq əvvəl</option>
              <option value="60">1 saat əvvəl</option>
            </Select>
          </Field>
          <Field label="Təkrar">
            <Select value={f.repeat} onChange={(e) => set('repeat', e.target.value as Repeat)}>
              <option value="none">Təkrarlanmır</option>
              <option value="daily">Hər gün</option>
              <option value="weekly">Hər həftə</option>
              <option value="monthly">Hər ay</option>
            </Select>
          </Field>
        </div>
        {f.repeat !== 'none' && (
          <Field label="Təkrar bitmə tarixi" error={errors.repeatUntil} hint="Boş qalsa, limitsiz təkrarlanır">
            <Input type="date" value={f.repeatUntil} onChange={(e) => set('repeatUntil', e.target.value)} />
          </Field>
        )}
        {editId && (
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as ItemStatus)}>
              <option value="pending">Gözləyir</option>
              <option value="done">Tamamlandı</option>
              <option value="cancelled">Ləğv edildi</option>
            </Select>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
