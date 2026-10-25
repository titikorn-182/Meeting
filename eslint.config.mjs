import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  // Remaining screen synchronization is tracked in QUALITY.md.
  {
    files: ['src/components/screens/resolutions.tsx', 'src/components/screens/settings.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  globalIgnores([
    '.next*/**',
    'out/**',
    'coverage/**',
    'next-env.d.ts',
    '.npm-cache/**',
    '.test-artifacts/**',
    '.impeccable/**',
    '.agents/**',
    '.codex/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
]);
