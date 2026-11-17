'use client';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-white shadow-float',
        variant === 'soft' && 'bg-soft text-primary dark:text-accent',
        variant === 'ghost' && 'text-muted',
        variant === 'danger' && 'bg-p-red text-expense',
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-expense">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-2xl border border-line bg-bg px-4 text-[16px] text-ink outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref,
) {
  return <input ref={ref} className={cn(inputCls, 'h-12', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...p },
  ref,
) {
  return <textarea ref={ref} className={cn(inputCls, 'min-h-[88px] py-3', className)} {...p} />;
});

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, 'h-12 appearance-none bg-[length:16px] pr-9', className)} {...p}>
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  dark,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div role="tablist" className={cn('flex rounded-2xl p-1', dark ? 'bg-white/10' : 'bg-soft', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition',
              active ? 'bg-primary text-white shadow-float' : dark ? 'text-white/75' : 'text-ink/80',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
  ...rest
}: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string; 'aria-label'?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 rounded-full border px-4 text-[14px] font-medium transition',
        active ? 'border-primary bg-primary text-white' : 'border-line bg-card text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp onClick={onClick} className={cn('block w-full rounded-3xl bg-card text-left shadow-card', className)}>
      {children}
    </Cmp>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-soft text-primary dark:text-accent">{icon}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-bold">{children}</h2>
      {action}
    </div>
  );
}
