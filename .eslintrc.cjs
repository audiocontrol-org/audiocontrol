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
      // events. The rule is scoped to the ENTIRE test/ui/ tree (Tier 2 +
      // Tier 3 + any future spec that lands at the root) so the drift
      // that #426 caught (5 root specs at modules/.../test/ui/*.spec.ts
      // using getByTestId + .click() — ungated by the prior
      // contract/in-context-only scope) cannot re-enter. Tier 1 wiring
      // specs (under test/wiring/) and rendering smokes (under
      // test/rendering/) are NOT linted because their semantics are
      // explicitly paint-only or seam-only and the discipline does not
      // apply at those tiers.
      files: [
        '**/test/ui/**/*.{ts,tsx}',
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