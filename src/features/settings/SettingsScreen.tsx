'use client';
import {
  CalendarDays, ChartColumn, ChevronRight, Cloud, FileText, House, Moon, Monitor, Settings2, Sun, Tag, Target, X, ChartPie,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Segmented } from '@/components/ui/controls';
import { useSettings } from '@/hooks/useData';
import { updateSettings } from '@/repositories';
import type { ThemeMode } from '@/types';
import { CategoriesSheet } from './CategoriesSheet';
import { DataSheet, lastBackupLabel } from './DataSheet';
import { useSyncStore } from '@/stores/sync';
import { GoalsSheet } from './GoalsSheet';
import { ProfileSheet } from './ProfileSheet';

export type SubSheet = 'categories' | 'goals' | 'profile' | 'sync' | null;

export function SettingsScreen() {
  const settings = useSettings();
  const router = useRouter();
  const [sub, setSub] = useState<SubSheet>(null);
  const syncState = useSyncStore();

  useEffect(() => {
    const open = new URLSearchParams(window.location.search).get('open');
    if (open === 'goals' || open === 'categories' || open === 'profile' || open === 'sync') setSub(open);
  }, []);

  const initials = (settings.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const links = [
    { href: '/', label: 'İdarə paneli', icon: House },
    { href: '/agenda/', label: 'Agenda', icon: CalendarDays },
    { href: '/budget/', label: 'Büdcə', icon: ChartColumn },
    { href: '/notes/', label: 'Notlar', icon: FileText },
    { href: '/reports/', label: 'Hesabatlar', icon: ChartPie },
  ];
  const actions: { key: Exclude<SubSheet, null>; label: string; icon: typeof Tag }[] = [
    { key: 'categories', label: 'Kateqoriyalar', icon: Tag },
    { key: 'goals', label: 'Hədəflər', icon: Target },
    { key: 'profile', label: 'Parametrlər', icon: Settings2 },
    { key: 'sync', label: 'Sinxronizasiya', icon: Cloud },
  ];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-navy to-navy-deep px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+16px)] text-white">
      <div className="flex justify-end">
        <button onClick={() => (history.length > 1 ? router.back() : router.push('/'))} aria-label="Bağla" className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <X size={20} />
        </button>
      </div>

      <button onClick={() => setSub('profile')} className="mt-2 flex w-full items-center gap-4 text-left">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-accent to-primary text-[22px] font-bold ring-4 ring-white/10">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[20px] font-bold">{settings.name || 'Ad daxil edin'}</span>
          <span className="block truncate text-[14px] text-white/65">{settings.email || 'E-poçt əlavə edin'}</span>
        </span>
      </button>

      <nav className="mt-7 space-y-1">
        {links.map((l, i) => (
          <Link key={l.href} href={l.href} className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[16px] ${i === 0 ? 'bg-white/10' : 'active:bg-white/5'}`}>
            <l.icon size={20} className="text-white/85" />
            <span className="flex-1">{l.label}</span>
            <ChevronRight size={16} className="text-white/35" />
          </Link>
        ))}
        <div className="my-3 border-t border-white/10" />
        {actions.map((a) => (
          <button key={a.key} onClick={() => setSub(a.key)} className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-[16px] active:bg-white/5">
            <a.icon size={20} className="text-white/85" />
            <span className="flex-1">
              {a.label}
              {a.key === 'sync' && (
                <span className="block text-[12px] text-white/50">
                  {syncState.enabled ? (syncState.phase === 'syncing' ? 'GitHub · sinxronlaşdırılır…' : syncState.phase === 'signed_out' ? 'GitHub · yenidən daxil olun' : 'GitHub sinxronizasiyası aktiv') : lastBackupLabel(settings.lastBackupAt)}
                </span>
              )}
            </span>
            <ChevronRight size={16} className="text-white/35" />
          </button>
        ))}
      </nav>

      <div className="mt-8">
        <p className="mb-2 px-1 text-[13px] text-white/55">Görünüş</p>
        <Segmented<ThemeMode>
          dark
          value={settings.theme}
          onChange={(theme) => void updateSettings({ theme })}
          options={[
            { value: 'light', label: <><Sun size={16} /> İşıqlı</> },
            { value: 'dark', label: <><Moon size={16} /> Qaranlıq</> },
            { value: 'system', label: <><Monitor size={16} /> Sistem</> },
          ]}
        />
      </div>

      <p className="mt-8 text-center text-[12px] text-white/40">MyAgenda v1.2 · build {process.env.NEXT_PUBLIC_BUILD_ID}</p>

      <ProfileSheet open={sub === 'profile'} onClose={() => setSub(null)} />
      <CategoriesSheet open={sub === 'categories'} onClose={() => setSub(null)} />
      <GoalsSheet open={sub === 'goals'} onClose={() => setSub(null)} />
      <DataSheet open={sub === 'sync'} onClose={() => setSub(null)} />
    </div>
  );
}
