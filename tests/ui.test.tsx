import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetRing } from '@/components/charts/BudgetRing';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useUI } from '@/stores/ui';

vi.mock('next/navigation', () => ({ usePathname: () => '/budget/' }));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a> }));

describe('UI', () => {
  it('BudgetRing shows percent', () => {
    render(<BudgetRing percent={67} level="ok" />);
    expect(screen.getByText('67%')).toBeInTheDocument();
  });
  it('BottomNav marks active route and opens Quick Add', () => {
    render(<BottomNav />);
    expect(screen.getByText('Büdcə').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Əsas').closest('a')).not.toHaveAttribute('aria-current');
    screen.getByLabelText('Sürətli əlavə et').click();
    expect(useUI.getState().quickAddOpen).toBe(true);
  });
});
