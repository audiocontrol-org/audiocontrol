module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './modules/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true },
    ],
    '@typescript-eslint/no-non-null-assertion': 'error',
  },
  overrides: [
    {
      // Test-discipline enforcement per
      // docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md
      // §4 (Validity Claim A): Tier 2/3 specs must originate user input
      // from accessible role+name queries and real pointer / keyboard
      // events. The rule is scoped to the canonical Tier 2/3 directories
      // ONLY; Tier 1 wiring specs (under test/wiring/) are explicitly
      // NOT linted because their wiring-test shortcuts are part of
      // Tier 1's contract. (Prior to 9R-A.2 the same exclusion covered a
      // legacy test/ui/capabilities/ directory, which has since been
      // migrated wholesale into test/wiring/ and deleted.)
      files: [
        '**/test/ui/contract/**/*.{ts,tsx}',
        '**/test/ui/in-context/**/*.{ts,tsx}',
      ],
      // These specs live outside the per-module tsconfig `include`, so
      // type-aware linting is disabled here. The discipline rules below
      // operate on the AST only and do not need type information.
      parserOptions: {
        project: null,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/disable-type-checked',
      ],
      plugins: ['@audiocontrol/test-discipline'],
      rules: {
        '@audiocontrol/test-discipline/no-forbidden-ui-patterns': 'error',
        '@audiocontrol/test-discipline/no-internal-imports': 'error',
      },
    },
  ],
  ignorePatterns: ['dist', 'build', 'node_modules', '*.js', '*.cjs'],
};