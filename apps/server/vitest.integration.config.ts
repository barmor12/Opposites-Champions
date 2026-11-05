import { defineConfig } from 'vitest/config';
import { sharedAliases, swcPlugin } from './vitest.config';

export default defineConfig({
  plugins: [swcPlugin],
  resolve: { alias: sharedAliases },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    exclude: ['node_modules', 'dist'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globals: false,
  },
});
