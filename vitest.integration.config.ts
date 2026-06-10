import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration tests spin up a real Anvil node and deploy Solidity fixtures.
// They run in the node environment (no jsdom/fake-indexeddb), serially, with
// no coverage. Kept separate from the unit suite via the *.itest.ts pattern.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
