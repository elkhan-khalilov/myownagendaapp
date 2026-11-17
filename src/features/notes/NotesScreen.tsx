'use client';
import { Bookmark, Clock, Ellipsis, FileText, ListFilter, ListTodo, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { useNow } from '@/hooks/useNow';
import { useState } from 'react';
import { Chip, EmptyState, Input } from '@/components/ui/controls';
import { NOTE_META } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { useNotes } from '@/hooks/useData';
import { notesRepo } from '@/repositories';
import { confirmAction, undoToast, useUI } from '@/stores/ui';
import type { Note, NoteCategory } from '@/types';
import { noteMatches, recentlyEdited, sortNotes, type NoteSort } from '@/services/notes';
import { relativeUpdated } from '@/utils/date';
import { cn } from '@/utils/cn';

type Sort = NoteSort;
const SORTS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Son dəyişiklik' },
  { value: 'created', label: 'Yaradılma tarixi' },
  { value: 'title', label: 'Başlıq (A–Z)' },
];

export function NotesScreen() {
  const notes = useNotes();
  const openSheet = useUI((s) => s.openSheet);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | NoteCategory>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Note | null>(null);

  const now = useNow();
  const query = q.trim();
  const list = sortNotes(
    (notes ?? [])
      .filter((n) => cat === 'all' || n.category === cat)
      .filter((n) => !pinnedOnly || n.pinned)
      .filter((n) => noteMatches(n, query)),
    sort,
  );
  const showRecent = !query && cat === 'all' && !pinnedOnly && (notes?.length ?? 0) > 3;
  const recent = showRecent ? recentlyEdited(notes ?? [], now, 5) : [];

  async function togglePin(n: Note) {
    await notesRepo.update(n.id, { pinned: !n.pinned });
    setMenuFor(null);
  }
  async function remove(n: Note) {
    setMenuFor(null);
    const ok = await confirmAction({ title: 'Qeyd silinsin?', message: n.title || undefined, confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    const rec = await notesRepo.remove(n.id);
    if (rec) undoToast('Qeyd silindi', () => notesRepo.restore(rec));
  }

  return (
    <PullToRefresh>
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <h1 className="mb-4 text-[30px] font-bold tracking-tight">Notlar</h1>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Axtar..." className="h-11 border-transparent bg-soft pl-11" maxLength={100} aria-label="Qeydlərdə tam mətn axtarışı" />
        </div>
        <button onClick={() => setSortOpen(true)} aria-label="Sıralama" className="grid h-11 w-11 place-items-center rounded-2xl bg-soft text-primary dark:text-accent">
          <ListFilter size={19} />
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>Hamısı</Chip>
        {(Object.keys(NOTE_META) as NoteCategory[]).map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {NOTE_META[c].label}
          </Chip>
        ))}
        <Chip active={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)} aria-label="Yalnız sancaqlananlar" className="px-3">
          <Bookmark size={16} className={pinnedOnly ? 'fill-white' : ''} />
        </Chip>
      </div>

      {recent.length > 0 && (
        <section className="mt-4" aria-label="Son redaktə olunanlar">
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <Clock size={14} /> Son redaktə olunanlar
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {recent.map((n) => {
              const m = NOTE_META[n.category];
              return (
                <button key={n.id} onClick={() => openSheet({ type: 'note', id: n.id })} className="w-36 shrink-0 rounded-2xl bg-card p-3 text-left shadow-card">
                  <m.icon size={15} className={m.fg} />
                  <span className="mt-1.5 line-clamp-2 block text-[13.5px] font-semibold leading-snug">{n.title || 'Başlıqsız'}</span>
                  <span className="mt-1 block text-[11.5px] text-muted">{relativeUpdated(n.updatedAt)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(notes?.length ?? 0) > 0 && <p className="mt-3 text-center text-[11.5px] text-muted">Sağa sürüşdür — sancaqla · Sola — sil</p>}
      <div className="mt-3 space-y-3 pb-20">
        {notes && list.length === 0 && (
          <EmptyState
            icon={<FileText />}
            title={query || cat !== 'all' || pinnedOnly ? 'Heç nə tapılmadı' : 'Hələ qeyd yoxdur'}
            action={
              <button onClick={() => openSheet({ type: 'note', category: cat === 'all' ? undefined : cat })} className="text-sm font-semibold text-primary dark:text-accent">
                + Yeni qeyd
              </button>
            }
          />
        )}
        {list.map((n) => {
          const m = NOTE_META[n.category];
          return (
            <SwipeRow
              key={n.id}
              className="rounded-3xl"
              left={{ label: n.pinned ? 'Sancağı götür' : 'Sancaqla', icon: n.pinned ? <PinOff size={18} /> : <Pin size={18} />, className: 'bg-primary text-white', onTrigger: () => void togglePin(n) }}
              right={{ label: 'Sil', icon: <Trash2 size={18} />, className: 'bg-expense text-white', onTrigger: () => void remove(n) }}
            >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openSheet({ type: 'note', id: n.id })}
              onKeyDown={(e) => e.key === 'Enter' && openSheet({ type: 'note', id: n.id })}
              className={cn('rounded-3xl p-4 transition active:scale-[0.99]', m.bg)}
            >
              <div className="flex items-start gap-2.5">
                <span className={cn('mt-0.5 shrink-0', m.fg)}>{n.pinned ? <Pin size={18} className="fill-current" /> : <m.icon size={18} />}</span>
                <h3 className="flex-1 text-[16px] font-bold leading-snug">{n.title || 'Başlıqsız'}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(n);
                  }}
                  aria-label="Əlavə seçimlər"
                  className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-muted"
                >
                  <Ellipsis size={18} />
                </button>
              </div>
              {n.body && <p className="mt-1.5 line-clamp-4 whitespace-pre-line pl-7 text-[14px] text-ink/80">{n.body}</p>}
              <p className="mt-2 pl-7 text-[12px] text-muted">{relativeUpdated(n.updatedAt)}</p>
            </div>
            </SwipeRow>
          );
        })}
      </div>

      <button
        onClick={() => openSheet({ type: 'note', category: cat === 'all' ? undefined : cat })}
        aria-label="Yeni qeyd"
        className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-224px))] z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-float"
      >
        <Plus size={26} />
      </button>

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sıralama">
        <div className="space-y-2 pb-2">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setSort(s.value);
                setSortOpen(false);
              }}
              className={cn('flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left font-medium', sort === s.value ? 'bg-p-blue text-primary dark:text-accent' : 'bg-bg')}
            >
              {s.label}
              {sort === s.value && <span>✓</span>}
            </button>
          ))}
          <p className="px-1 pt-1 text-xs text-muted">Sancaqlanan qeydlər həmişə yuxarıda göstərilir.</p>
        </div>
      </Sheet>

      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.title || 'Qeyd'}>
        {menuFor && (
          <div className="space-y-2 pb-2">
            <MenuBtn icon={<Pencil size={18} />} label="Redaktə et" onClick={() => { setMenuFor(null); openSheet({ type: 'note', id: menuFor.id }); }} />
            <MenuBtn
              icon={<ListTodo size={18} />}
              label="Tapşırığa çevir"
              onClick={() => {
                const title = (menuFor.title || menuFor.body.split('\n').find((l) => l.trim()) || '').replace(/^[•\-*]\s*/, '').slice(0, 200);
                setMenuFor(null);
                openSheet({ type: 'task', kind: 'task', prefill: { title, description: menuFor.body.slice(0, 5000) } });
              }}
            />
            <MenuBtn icon={menuFor.pinned ? <PinOff size={18} /> : <Pin size={18} />} label={menuFor.pinned ? 'Sancağı götür' : 'Sancaqla'} onClick={() => void togglePin(menuFor)} />
            <MenuBtn icon={<Trash2 size={18} />} label="Sil" danger onClick={() => void remove(menuFor)} />
          </div>
        )}
      </Sheet>
    </div>
    </PullToRefresh>
  );
}

function MenuBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-3 rounded-2xl bg-bg px-4 py-3.5 font-medium', danger && 'text-expense')}>
      {icon}
      {label}
    </button>
  );
}
