'use client';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { CategoryShare } from '@/services/finance';

export default function ExpenseDonut({ data }: { data: CategoryShare[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data.map((d) => ({ name: d.category.name, value: d.amount, color: d.category.color }))}
          dataKey="value"
          innerRadius="68%"
          outerRadius="100%"
          paddingAngle={data.length > 1 ? 2 : 0}
          stroke="none"
          startAngle={90}
          endAngle={-270}
          isAnimationActive
        >
          {data.map((d) => (
            <Cell key={d.category.id} fill={d.category.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
