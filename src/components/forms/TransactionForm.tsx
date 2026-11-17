'use client';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Segmented, Textarea } from '@/components/ui/controls';
import { CategoryIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { DEFAULT_ACCOUNT_ID } from '@/db/seed';
import { useCategories, useSettings } from '@/hooks/useData';
import { transactionsRepo, updateSettings } from '@/repositories';
import { confirmAction, undoToast, useUI } from '@/stores/ui';
import { DateQuickPick } from './DateQuickPick';
import { haptic } from '@/utils/haptics';
import type { TransactionType } from '@/types';
import { todayKey } from '@/utils/date';
import { cn } from '@/utils/cn';
import { CURRENCY_SYMBOL, minorToInput, parseMoney } from '@/utils/money';

export function TransactionFormSheet() {
  const { sheet, closeSheet, showToast } = useUI();
  const open = sheet?.type === 'transaction';
  const editId = open ? sheet.id : undefined;
  const categories = useCategories();
  const settings = useSettings();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (!sheet.id) {
      const t = sheet.txType ?? 'expense';
      setType(t);
      setAmount('');
      // Quick entry: preselect the last category used for this type
      setCategoryId((t === 'income' ? settings.lastIncomeCategoryId : settings.lastExpenseCategoryId) ?? '');
      setDate(todayKey());
      setNote('');
      return;
    }
    transactionsRepo.get(sheet.id).then((r) => {
      if (!r) return;
      setType(r.type);
      setAmount(minorToInput(r.amount));
      setCategoryId(r.categoryId);
      setDate(r.date);
      setNote(r.note ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const cats = categories.filter((c) => c.type === type);

  async function save() {
    const e: Record<string, string> = {};
    const minor = parseMoney(amount);
    if (minor === null) e.amount = 'Düzgün məbləğ daxil edin (məs. 12,50)';
    if (!categoryId || !cats.some((c) => c.id === categoryId)) e.category = 'Kateqoriya seçin';
    if (!date) e.date = 'Tarix seçin';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = { type, amount: minor!, categoryId, date, note: note.trim() || undefined, accountId: DEFAULT_ACCOUNT_ID };
    try {
      if (editId) await transactionsRepo.update(editId, data);
      else await transactionsRepo.create(data);
      await updateSettings(type === 'income' ? { lastIncomeCategoryId: categoryId } : { lastExpenseCategoryId: categoryId });
      haptic('success');
      showToast({ message: editId ? 'Yadda saxlanıldı' : type === 'income' ? 'Gəlir əlavə edildi' : 'Xərc əlavə edildi' });
      closeSheet();
    } catch (err) {
      showToast({ message: (err as Error).message, tone: 'error' });
    }
  }

  async function remove() {
    if (!editId) return;
    const ok = await confirmAction({ title: 'Əməliyyat silinsin?', confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    const rec = await transactionsRepo.remove(editId);
    closeSheet();
    if (rec) undoToast('Əməliyyat silindi', () => transactionsRepo.restore(rec));
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={editId ? 'Əməliyyatı redaktə et' : type === 'income' ? 'Gəlir əlavə et' : 'Xərc əlavə et'}
      footer={
        <div className="flex gap-3">
          {editId && (
            <Button variant="danger" onClick={remove} aria-label="Sil" className="w-12 px-0">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Yadda saxla
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Segmented
          value={type}
          onChange={(t) => {
            setType(t);
            setCategoryId((t === 'income' ? settings.lastIncomeCategoryId : settings.lastExpenseCategoryId) ?? '');
          }}
          options={[
            { value: 'expense', label: 'Xərc' },
            { value: 'income', label: 'Gəlir' },
          ]}
        />
        <Field label="Məbləğ" error={errors.amount}>
          <div className="relative">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,\s]/g, ''))}
              placeholder="0,00"
              className={cn('pr-12 text-[22px] font-bold', type === 'income' ? 'text-income' : 'text-expense')}
              autoFocus={!editId}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void save();
                }
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
              {CURRENCY_SYMBOL[settings.currency]}
            </span>
          </div>
        </Field>
        <Field label="Kateqoriya" error={errors.category}>
          <div className="grid grid-cols-3 gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                aria-pressed={categoryId === c.id}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[12px] font-medium transition',
                  categoryId === c.id ? 'border-primary bg-p-blue' : 'border-line bg-bg',
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: c.color }}>
                  <CategoryIcon icon={c.icon} size={16} />
                </span>
                <span className="line-clamp-1">{c.name}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tarix" error={errors.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <DateQuickPick value={date} onChange={setDate} past />
        </Field>
        <Field label="Təsvir (istəyə bağlı)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Məs. Bazarlıq" maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
}
