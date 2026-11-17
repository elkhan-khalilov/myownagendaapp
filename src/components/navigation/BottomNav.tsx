'use client';
import { CalendarDays, ChartColumn, FileText, House, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUI } from '@/stores/ui';
import { cn } from '@/utils/cn';

const ITEMS = [
  { href: '/', label: 'Əsas', icon: House },
  { href: '/agenda/', label: 'Agenda', icon: CalendarDays },
  null,
  { href: '/budget/', label: 'Büdcə', icon: ChartColumn },
  { href: '/notes/', label: 'Notlar', icon: FileText },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, '')));

  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-card/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid h-[68px] grid-cols-5 items-center">
        {ITEMS.map((item, i) =>
          item === null ? (
            <li key="plus" className="flex justify-center">
              <button
                onClick={() => setQuickAdd(true)}
                aria-label="Sürətli əlavə et"
                className="-mt-1 grid h-[52px] w-[52px] place-items-center rounded-full bg-primary text-white shadow-float transition active:scale-95"
              >
                <Plus size={26} strokeWidth={2.5} />
              </button>
            </li>
          ) : (
            <li key={i}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 text-[11px] font-medium',
                  isActive(item.href) ? 'text-primary dark:text-accent' : 'text-muted',
                )}
              >
                <item.icon size={22} strokeWidth={isActive(item.href) ? 2.4 : 1.9} />
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
