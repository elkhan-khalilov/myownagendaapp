'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthPoint } from '@/services/finance';
import { formatCompact, formatMoney } from '@/utils/money';

export default function MonthlyBars({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={3} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="rgb(var(--line))" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompact} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} width={44} />
        <Tooltip
          cursor={{ fill: 'rgb(var(--soft))', opacity: 0.6 }}
          formatter={(v, name) => [formatMoney(Number(v)), name === 'income' ? 'Gəlir' : 'Xərc']}
          contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.12)', fontSize: 13 }}
        />
        <Bar dataKey="income" fill="#37C78B" radius={[6, 6, 2, 2]} maxBarSize={12} />
        <Bar dataKey="expense" fill="#3565CE" radius={[6, 6, 2, 2]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}
