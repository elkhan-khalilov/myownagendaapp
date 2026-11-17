import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/no-danger': 'error',
    },
  },
  { files: ['tests/**', 'scripts/**', 'e2e/**'], rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' } },
];

export default config;
