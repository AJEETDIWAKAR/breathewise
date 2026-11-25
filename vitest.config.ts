import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'server/providers/types.ts',
        'src/types/**',
      ],
      thresholds: {
        statements: 95,
        lines: 96,
        functions: 95,
        branches: 82,
      },
    },
  },
});

