import {
  BookOpen, Briefcase, Car, ChartColumn, Dumbbell, Ellipsis, Gift, Heart, House, Lightbulb, Plus,
  Presentation, ShoppingBag, Smile, SquareCheck, TrendingUp, User, Users, UtensilsCrossed, Video, Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { NoteCategory } from '@/types';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: House,
  utensils: UtensilsCrossed,
  car: Car,
  users: Users,
  heart: Heart,
  shopping: ShoppingBag,
  smile: Smile,
  book: BookOpen,
  more: Ellipsis,
  wallet: Wallet,
  gift: Gift,
  plus: Plus,
  trending: TrendingUp,
  chart: ChartColumn,
};

export const ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function CategoryIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const I = CATEGORY_ICONS[icon] ?? Ellipsis;
  return <I size={size} />;
}

export const OCCURRENCE_STYLE = {
  blue: { bg: 'bg-p-blue', fg: 'text-primary dark:text-accent', bar: 'bg-primary' },
  red: { bg: 'bg-p-red', fg: 'text-expense', bar: 'bg-expense' },
  purple: { bg: 'bg-p-purple', fg: 'text-[#7C5CF0]', bar: 'bg-[#7C5CF0]' },
  green: { bg: 'bg-p-green', fg: 'text-income', bar: 'bg-income' },
  yellow: { bg: 'bg-p-yellow', fg: 'text-[#E09A1F]', bar: 'bg-warn' },
} as const;

export const TASK_CATEGORY_META = {
  general: { label: 'Ümumi', icon: SquareCheck },
  important: { label: 'Vacib', icon: SquareCheck },
  presentation: { label: 'Təqdimat', icon: Presentation },
  personal: { label: 'Şəxsi', icon: User },
  exercise: { label: 'İdman', icon: Dumbbell },
} as const;

export const MeetingIcon = Video;

export const NOTE_META: Record<NoteCategory, { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  work: { label: 'İş', icon: Briefcase, bg: 'bg-p-blue', fg: 'text-primary dark:text-accent' },
  idea: { label: 'İdeya', icon: Lightbulb, bg: 'bg-p-yellow', fg: 'text-[#E09A1F]' },
  personal: { label: 'Şəxsi', icon: User, bg: 'bg-p-green', fg: 'text-income' },
};
