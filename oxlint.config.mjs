import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'import'],
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'warn',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'typescript/no-non-null-assertion': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/**', 'node_modules/**', '**/src/data/*.json', '**/routeTree.gen.ts'],
})
