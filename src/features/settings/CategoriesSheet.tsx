'use client';
import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, Segmented } from '@/components/ui/controls';
import { CategoryIcon, ICON_KEYS } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { useCategories } from '@/hooks/useData';
import { categoriesRepo, deleteCategory } from '@/repositories';
import { confirmAction, useUI } from '@/stores/ui';
import type { TransactionCategory, TransactionType } from '@/types';
import { cn } from '@/utils/cn';

const COLORS = ['#3565CE', '#37C78B', '#8B7CF6', '#F06464', '#2BB5C9', '#F4B84C', '#E879B9', '#5B8DEF', '#9AA7BD'];

export function CategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useCategories();
  const showToast = useUI((s) => s.showToast);
  const [type, setType] = useState<TransactionType>('expense');
  const [editing, setEditing] = useState<TransactionCategory | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('more');

  const list = categories.filter((c) => c.type === type);

  function startEdit(c: TransactionCategory | 'new') {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setColor(c === 'new' ? COLORS[0] : c.color);
    setIcon(c === 'new' ? 'more' : c.icon);
  }

  async function save() {
    const n = name.trim();
    if (!n) return showToast({ message: 'Ad daxil edin', tone: 'error' });
    const dup = list.some((c) => c.name.toLocaleLowerCase('az') === n.toLocaleLowerCase('az') && (editing === 'new' || c.id !== editing?.id));
    if (dup) return showToast({ message: 'Bu adda kateqoriya artıq var', tone: 'error' });
    if (editing === 'new') {
      await categoriesRepo.create({ name: n, color, icon, type, isDefault: false, sort: list.length + 100 });
    } else if (editing) {
      await categoriesRepo.update(editing.id, { name: n, color, icon });
    }
    setEditing(null);
  }

  async function remove(c: TransactionCategory) {
    if (!(await confirmAction({ title: `"${c.name}" silinsin?`, message: 'Bu kateqoriyanın limiti də silinəcək.', confirmLabel: 'Sil', danger: true }))) return;
    const ok = await deleteCategory(c.id);
    showToast(ok ? { message: 'Kateqoriya silindi' } : { message: 'Bu kateqoriyada əməliyyatlar var — silmək olmaz', tone: 'error' });
    if (ok) setEditing(null);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Kateqoriyalar">
      <div className="space-y-4 pt-1">
        <Segmented value={type} onChange={(t) => { setType(t); setEditing(null); }} options={[{ value: 'expense', label: 'Xərc' }, { value: 'income', label: 'Gəlir' }]} />
        {editing ? (
          <div className="space-y-4 rounded-2xl bg-bg p-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kateqoriya adı" autoFocus maxLength={40} />
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={`Rəng ${c}`} className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: c }}>
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ICON_KEYS.map((k) => (
                <button key={k} onClick={() => setIcon(k)} aria-label={`İkon ${k}`} className={cn('grid h-10 w-10 place-items-center rounded-xl', icon === k ? 'text-white' : 'bg-card text-muted')} style={icon === k ? { background: color } : undefined}>
                  <CategoryIcon icon={k} size={18} />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {editing !== 'new' && (
                <Button variant="danger" className="w-12 px-0" aria-label="Sil" onClick={() => void remove(editing)}>
                  <Trash2 size={18} />
                </Button>
              )}
              <Button variant="soft" className="flex-1" onClick={() => setEditing(null)}>Ləğv et</Button>
              <Button className="flex-1" onClick={save}>Yadda saxla</Button>
            </div>
          </div>
        ) : (
          <Button variant="soft" className="w-full" onClick={() => startEdit('new')}>+ Yeni kateqoriya</Button>
        )}
        <ul className="space-y-2 pb-2">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => startEdit(c)} className="flex w-full items-center gap-3 rounded-2xl bg-bg px-3 py-2.5 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: c.color }}>
                  <CategoryIcon icon={c.icon} size={17} />
                </span>
                <span className="flex-1 font-medium">{c.name}</span>
                {c.isDefault && <span className="text-xs text-muted">standart</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
