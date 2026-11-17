'use client';
import { ArrowDownLeft, ArrowUpRight, CalendarPlus, FilePlus2, ListPlus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { useUI } from '@/stores/ui';

export function QuickAddSheet() {
  const { quickAddOpen, setQuickAdd, openSheet } = useUI();
  const actions = [
    { label: 'Yeni tapşırıq', icon: ListPlus, cls: 'bg-p-blue text-primary dark:text-accent', go: () => openSheet({ type: 'task', kind: 'task' }) },
    { label: 'Yeni görüş', icon: CalendarPlus, cls: 'bg-p-purple text-[#7C5CF0]', go: () => openSheet({ type: 'task', kind: 'meeting' }) },
    { label: 'Gəlir əlavə et', icon: ArrowDownLeft, cls: 'bg-p-green text-income', go: () => openSheet({ type: 'transaction', txType: 'income' }) },
    { label: 'Xərc əlavə et', icon: ArrowUpRight, cls: 'bg-p-red text-expense', go: () => openSheet({ type: 'transaction', txType: 'expense' }) },
    { label: 'Yeni qeyd', icon: FilePlus2, cls: 'bg-p-yellow text-[#E09A1F]', go: () => openSheet({ type: 'note' }) },
  ];
  return (
    <Sheet open={quickAddOpen} onClose={() => setQuickAdd(false)} title="Sürətli əlavə">
      <div className="grid grid-cols-2 gap-3 pb-2 pt-1">
        {actions.map((a, i) => (
          <button
            key={a.label}
            onClick={a.go}
            className={`flex items-center gap-3 rounded-2xl border border-line bg-bg p-4 text-left font-semibold transition active:scale-[0.98] ${i === 4 ? 'col-span-2' : ''}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${a.cls}`}>
              <a.icon size={20} />
            </span>
            <span className="text-[15px]">{a.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
