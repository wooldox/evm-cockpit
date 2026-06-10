import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Non-app files: design prototypes and generated output
    'docs/**',
    // Test coverage output
    'coverage/**',
    // Solidity fixtures + their generated artifacts (not linted as JS/TS)
    'contracts/**',
    'src/test/artifacts/**',
  ]),
]);

export default eslintConfig;
