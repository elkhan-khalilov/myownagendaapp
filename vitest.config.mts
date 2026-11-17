import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts?(x)'],
    // Run in Baku time (UTC+4) to catch UTC/local date-key mistakes
    env: { TZ: 'Asia/Baku' },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
