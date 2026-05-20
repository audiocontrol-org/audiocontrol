/**
 * `no-internal-imports` — enforces Validity Claim A from
 * docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §4.
 *
 * Forbids imports from `**\/src/internal/**` and `**\/src/private/**` under
 * Tier 2/3 UI specs. Reaching into a module's internal-implementation
 * surface bypasses the user-facing contract the spec is supposed to verify.
 *
 * Tier 1 wiring specs (under `test/wiring/`) are NOT linted by this rule;
 * a protocol-correctness test legitimately probes encoding internals.
 */
import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

type MessageIds = 'noInternalImport' | 'noPrivateImport';

const SPEC_REF =
  'See testing-and-inventory-reform-spec.md §4 (Validity Claim A).';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/orion/audiocontrol/blob/main/modules/eslint-plugin-test-discipline/README.md#${name}`,
);

const INTERNAL_PATH = '/src/internal/';
const PRIVATE_PATH = '/src/private/';

export const noInternalImports = createRule<[], MessageIds>({
  name: 'no-internal-imports',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid imports from src/internal/ or src/private/ inside Tier 2/3 UI specs; tests must verify the user-facing contract, not implementation internals.',
    },
    messages: {
      noInternalImport: `Forbidden in test/ui/: import from \`src/internal/\` reaches past the module's public surface. Verify the user-facing contract instead. ${SPEC_REF}`,
      noPrivateImport: `Forbidden in test/ui/: import from \`src/private/\` reaches past the module's public surface. Verify the user-facing contract instead. ${SPEC_REF}`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkSource(node: TSESTree.Node, source: string): void {
      if (source.includes(INTERNAL_PATH)) {
        context.report({ node, messageId: 'noInternalImport' });
        return;
      }
      if (source.includes(PRIVATE_PATH)) {
        context.report({ node, messageId: 'noPrivateImport' });
      }
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration): void {
        if (typeof node.source.value !== 'string') return;
        checkSource(node.source, node.source.value);
      },
      ImportExpression(node: TSESTree.ImportExpression): void {
        const arg = node.source;
        if (
          arg.type === 'Literal' &&
          typeof arg.value === 'string'
        ) {
          checkSource(arg, arg.value);
        }
      },
    };
  },
});
