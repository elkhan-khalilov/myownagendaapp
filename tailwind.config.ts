import type { Config } from 'tailwindcss';
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#18345D',
        'navy-deep': '#102747',
        primary: '#3565CE',
        accent: '#4779E8',
        income: '#37C78B',
        expense: '#F06464',
        warn: '#F4B84C',
        bg: v('bg'),
        card: v('card'),
        soft: v('soft'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        'p-blue': v('p-blue'),
        'p-red': v('p-red'),
        'p-purple': v('p-purple'),
        'p-green': v('p-green'),
        'p-yellow': v('p-yellow'),
      },
      boxShadow: {
        card: '0 4px 18px -6px rgba(24, 52, 93, 0.14)',
        float: '0 10px 24px -8px rgba(53, 101, 206, 0.55)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.375rem' },
    },
  },
  plugins: [],
} satisfies Config;
