'use client';
import { Check, ListTodo, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Chip } from '@/components/ui/controls';
import { NOTE_META } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { notesRepo } from '@/repositories';
import { confirmAction, undoToast, useUI } from '@/stores/ui';
import { textStats } from '@/services/notes';
import type { NoteCategory } from '@/types';
import { cn } from '@/utils/cn';

const AUTOSAVE_MS = 500;

export function NoteEditorSheet() {
  const { sheet, closeSheet, openSheet } = useUI();
  const open = sheet?.type === 'note';
  const initialId = open ? sheet.id : undefined;

  const [noteId, setNoteId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoteCategory>('work');
  const [pinned, setPinned] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dirty = useRef(false);
  const idRef = useRef<string | undefined>(undefined);
  const creating = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (!open) return;
    dirty.current = false;
    creating.current = null;
    setSaved('idle');
    setNoteId(initialId);
    idRef.current = initialId;
    if (!initialId) {
      setTitle('');
      setBody('');
      setCategory(sheet.category ?? 'work');
      setPinned(false);
      return;
    }
    notesRepo.get(initialId).then((n) => {
      if (!n) return;
      setTitle(n.title);
      setBody(n.body);
      setCategory(n.category);
      setPinned(n.pinned);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialId]);

  async function persist() {
    const empty = !title.trim() && !body.trim();
    const data = { title: title.trim(), body, category, pinned };
    if (!idRef.current) {
      if (empty) return;
      if (!creating.current) {
        creating.current = notesRepo.create(data).then((n) => n.id);
      }
      const id = await creating.current;
      idRef.current = id;
      setNoteId(id);
    } else {
      await notesRepo.update(idRef.current, data);
    }
    setSaved('saved');
  }

  // Debounced auto-save
  useEffect(() => {
    if (!open || !dirty.current) return;
    setSaved('saving');
    const t = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, category, pinned]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  async function handleClose() {
    if (dirty.current) await persist();
    closeSheet();
  }

  async function toTask() {
    if (dirty.current) await persist();
    const firstLine = body.split('\n').find((l) => l.trim()) ?? '';
    openSheet({
      type: 'task',
      kind: 'task',
      prefill: { title: (title.trim() || firstLine.replace(/^[•\-*]\s*/, '')).slice(0, 200), description: body.slice(0, 5000) },
    });
  }

  async function remove() {
    const id = idRef.current;
    if (!id) return closeSheet();
    const ok = await confirmAction({ title: 'Qeyd silinsin?', message: title || undefined, confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    closeSheet();
    const rec = await notesRepo.remove(id);
    if (rec) undoToast('Qeyd silindi', () => notesRepo.restore(rec));
  }

  return (
    <Sheet open={open} onClose={handleClose} tall title={noteId ? 'Qeyd' : 'Yeni qeyd'}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(Object.keys(NOTE_META) as NoteCategory[]).map((c) => (
            <Chip key={c} active={category === c} onClick={() => touch(setCategory)(c)}>
              {NOTE_META[c].label}
            </Chip>
          ))}
          <button
            onClick={() => touch(setPinned)(!pinned)}
            aria-pressed={pinned}
            aria-label={pinned ? 'Sancağı götür' : 'Sancaqla'}
            className={cn('ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full', pinned ? 'bg-primary text-white' : 'bg-soft text-muted')}
          >
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
          {(title.trim() || body.trim()) && (
            <button onClick={toTask} aria-label="Tapşırığa çevir" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-primary dark:text-accent">
              <ListTodo size={16} />
            </button>
          )}
          {noteId && (
            <button onClick={remove} aria-label="Sil" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-p-red text-expense">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <input
          value={title}
          onChange={(e) => touch(setTitle)(e.target.value)}
          placeholder="Başlıq"
          className="w-full bg-transparent text-[22px] font-bold outline-none placeholder:text-muted/60"
          autoFocus={!initialId}
          maxLength={200}
        />
        <textarea
          value={body}
          onChange={(e) => touch(setBody)(e.target.value)}
          placeholder="Yazmağa başlayın…"
          maxLength={50000}
          spellCheck
          className="min-h-[50dvh] w-full flex-1 resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted/60"
        />
        <div className="flex items-center justify-between pb-2 text-xs text-muted">
        <span>{textStats(body).words} söz · {textStats(body).chars} simvol</span>
        <p className="flex items-center gap-1" aria-live="polite">
          {saved === 'saving' && 'Yadda saxlanılır…'}
          {saved === 'saved' && (
            <>
              <Check size={14} className="text-income" /> Avtomatik yadda saxlanıldı
            </>
          )}
        </p>
        </div>
      </div>
    </Sheet>
  );
}
