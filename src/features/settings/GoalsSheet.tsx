'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input } from '@/components/ui/controls';
import { CategoryIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { useBudgets, useCategories, useSettings, useTransactions } from '@/hooks/useData';
import { setBudgetLimit } from '@/repositories';
import { budgetStatus, inMonth, summarize } from '@/services/finance';
import { useUI } from '@/stores/ui';
import { TOTAL_BUDGET_KEY } from '@/types';
import { monthKey } from '@/utils/date';
import { CURRENCY_SYMBOL, formatMoney, minorToInput, parseMoney } from '@/utils/money';

/** Monthly spending limits — overall and per category ("Hədəflər"). */
export function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const budgets = useBudgets();
  const categories = useCategories().filter((c) => c.type === 'expense');
  const txs = useTransactions();
  const { currency } = useSettings();
  const showToast = useUI((s) => s.showToast);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const v: Record<string, string> = {};
    for (const b of budgets) v[b.categoryId] = minorToInput(b.limit);
    setValues(v);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const monthTxs = inMonth(txs, monthKey(new Date()));
  const spentBy = (catId: string) =>
    catId === TOTAL_BUDGET_KEY
      ? summarize(monthTxs).expense
      : monthTxs.filter((t) => t.type === 'expense' && t.categoryId === catId).reduce((a, t) => a + t.amount, 0);

  async function save() {
    const e: Record<string, boolean> = {};
    const parsed: [string, number][] = [];
    for (const key of [TOTAL_BUDGET_KEY, ...categories.map((c) => c.id)]) {
      const raw = (values[key] ?? '').trim();
      if (!raw || raw === '0') {
        parsed.push([key, 0]);
        continue;
      }
      const m = parseMoney(raw);
      if (m === null) e[key] = true;
      else parsed.push([key, m]);
    }
    setErrors(e);
    if (Object.keys(e).length) return showToast({ message: 'Bəzi məbləğlər düzgün deyil', tone: 'error' });
    for (const [k, v] of parsed) await setBudgetLimit(k, v);
    showToast({ message: 'Limitlər yadda saxlanıldı' });
    onClose();
  }

  const row = (key: string, label: React.ReactNode) => {
    const st = budgetStatus(parseMoney(values[key] ?? '') ?? 0, spentBy(key));
    return (
      <div key={key} className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{label}</div>
          <div className="text-[12px] text-muted">
            Bu ay: {formatMoney(st.spent, { currency })}
            {st.level !== 'none' && ` · ${st.percent}%`}
            {st.level === 'over' && <span className="text-expense"> · aşılıb</span>}
          </div>
        </div>
        <div className="relative w-32">
          <Input
            inputMode="decimal"
            value={values[key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            placeholder="Limit yox"
            aria-invalid={errors[key]}
            className={`h-11 pr-8 text-right ${errors[key] ? 'border-expense' : ''}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{CURRENCY_SYMBOL[currency]}</span>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Hədəflər — aylıq limitlər" footer={<Button className="w-full" onClick={save}>Yadda saxla</Button>}>
      <div className="space-y-5 pt-1">
        <Field label="Ümumi aylıq xərc limiti" hint="80%-ə çatanda xəbərdarlıq, aşanda qırmızı siqnal göstərilir">
          <div className="pt-1">{row(TOTAL_BUDGET_KEY, 'Bütün xərclər')}</div>
        </Field>
        <div>
          <p className="mb-3 text-[13px] font-medium text-muted">Kateqoriya limitləri</p>
          <div className="space-y-3.5">
            {categories.map((c) =>
              row(
                c.id,
                <span className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: c.color }}>
                    <CategoryIcon icon={c.icon} size={13} />
                  </span>
                  {c.name}
                </span>,
              ),
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
