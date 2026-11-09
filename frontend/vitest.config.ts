import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    maxWorkers: 1,
    testTimeout: 30_000,
    // Contrast tests consume actual CSS tokens; do not replace them with mocks.
    css: { include: [/tokens\.css/] },
  },
});
