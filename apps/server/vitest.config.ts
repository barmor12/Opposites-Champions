import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export const swcPlugin = swc.vite({
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
  },
  module: { type: 'es6' },
});

export const sharedAliases = {
  '@oc/shared': here('../../packages/shared/src/index.ts'),
  '@oc/content': here('../../packages/content/src/index.ts'),
};

export default defineConfig({
  plugins: [swcPlugin],
  resolve: { alias: sharedAliases },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts', 'node_modules', 'dist'],
    globals: false,
  },
});
