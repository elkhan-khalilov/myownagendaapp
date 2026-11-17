import type { Note } from '@/types';

export type NoteSort = 'updated' | 'created' | 'title';

/** Pinned notes first, then by the selected sort key. */
export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '', 'az');
    const k = sort === 'created' ? 'createdAt' : 'updatedAt';
    return a[k] < b[k] ? 1 : -1;
  });
}

/** Character and word counts (Unicode-aware, counts Azerbaijani letters correctly) */
export function textStats(text: string) {
  const chars = [...text].length;
  const words = text.trim() ? text.trim().split(/\s+/u).filter(Boolean).length : 0;
  return { chars, words };
}

export const RECENT_DAYS = 7;

/** Notes edited within the last RECENT_DAYS days, most recent first */
export function recentlyEdited(notes: Note[], now: Date, limit = 5): Note[] {
  const cutoff = new Date(now.getTime() - RECENT_DAYS * 864e5).toISOString();
  return [...notes].filter((n) => n.updatedAt >= cutoff).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, limit);
}

export function noteMatches(n: Note, query: string) {
  const q = query.trim().toLocaleLowerCase('az');
  if (!q) return true;
  const hay = `${n.title}\n${n.body}`.toLocaleLowerCase('az');
  // every word of the query must appear somewhere in the note (full-text, order independent)
  return q.split(/\s+/u).every((w) => hay.includes(w));
}
