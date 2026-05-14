/**
 * `no-forbidden-ui-patterns` — enforces Validity Claim A from
 * docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §4.
 *
 * Forbids in Tier 2/3 UI specs:
 *
 *   - `.fill(...)`          — Playwright shortcut that bypasses pointer + keyboard
 *   - `.value = ...`        — direct DOM value assignment
 *   - `.dispatchEvent(...)` — synthetic event dispatch
 *   - `element.click()`     — programmatic click that bypasses the pointer
 *   - `.getByTestId(...)`   — locator by test-id
 *   - `[data-testid=...]`   — attribute-selector form of the same
 *   - `[data-test=...]`     — alternate attribute name
 *
 * Tier 2/3 specs must originate input from accessible role+name queries and
 * real pointer / keyboard events. Tier 1 wiring specs (under `test/wiring/`)
 * are NOT linted by this rule — wiring-test shortcuts are part of Tier 1's
 * contract. See spec §4 ("Validity Claim A").
 */
import { ESLintUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

type MessageIds =
  | 'noFill'
  | 'noValueAssign'
  | 'noDispatchEvent'
  | 'noElementClick'
  | 'noGetByTestId'
  | 'noTestIdAttribute'
  | 'noTestAttribute';

const SPEC_REF =
  'See testing-and-inventory-reform-spec.md §4 (Validity Claim A).';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/orion/audiocontrol/blob/main/modules/eslint-plugin-test-discipline/README.md#${name}`,
);

function calleePropertyName(
  node: TSESTree.CallExpression | TSESTree.MemberExpression,
): string | null {
  const callee =
    node.type === AST_NODE_TYPES.CallExpression ? node.callee : node;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const prop = callee.property;
  if (prop.type === AST_NODE_TYPES.Identifier) return prop.name;
  if (
    prop.type === AST_NODE_TYPES.Literal &&
    typeof prop.value === 'string'
  ) {
    return prop.value;
  }
  return null;
}

function stringFromLiteralOrTemplate(
  node: TSESTree.Node,
): string | null {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === AST_NODE_TYPES.TemplateLiteral) {
    // Concatenate the static quasis. We only need substring checks against
    // them — interpolated `${expr}` segments cannot smuggle a literal
    // `[data-testid=` substring through, since the brackets and attribute
    // name are part of the surrounding quasi text.
    return node.quasis.map((q) => q.value.cooked).join('\0');
  }
  return null;
}

const TEST_ID_ATTR = '[data-testid';
const TEST_ATTR = '[data-test';

export const noForbiddenUiPatterns = createRule<[], MessageIds>({
  name: 'no-forbidden-ui-patterns',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid synthetic test patterns inside Tier 2/3 UI specs; tests must originate from accessible queries and real pointer events.',
    },
    messages: {
      noFill: `Forbidden in test/ui/: \`.fill()\` bypasses the pointer + keyboard engines. Use \`page.keyboard.type()\` after focusing via \`getByRole(...)\`, or \`page.mouse.*\` for sliders. ${SPEC_REF}`,
      noValueAssign: `Forbidden in test/ui/: direct \`.value = ...\` assignment bypasses the user's input path. Drive the control via \`page.keyboard.type()\` or \`page.mouse.*\`. ${SPEC_REF}`,
      noDispatchEvent: `Forbidden in test/ui/: \`dispatchEvent(...)\` synthesizes events the browser never fires. Use \`page.mouse.*\` / \`page.keyboard.*\` so the real pointer / keyboard engines run. ${SPEC_REF}`,
      noElementClick: `Forbidden in test/ui/: programmatic \`element.click()\` bypasses pointer hit-testing. Use \`locator.click()\` after \`getByRole(...)\` so the pointer engine runs (or \`page.mouse.*\` for explicit coordinates). ${SPEC_REF}`,
      noGetByTestId: `Forbidden in test/ui/: \`getByTestId(...)\` couples the test to layout encoding. Locate by accessible role + name (\`getByRole('slider', { name: 'Cutoff' })\`). ${SPEC_REF}`,
      noTestIdAttribute: `Forbidden in test/ui/: \`[data-testid=...]\` attribute selectors couple tests to layout encoding. Locate by accessible role + name. ${SPEC_REF}`,
      noTestAttribute: `Forbidden in test/ui/: \`[data-test=...]\` attribute selectors couple tests to layout encoding. Locate by accessible role + name. ${SPEC_REF}`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function reportStringNode(node: TSESTree.Node, value: string): void {
      if (value.includes(TEST_ID_ATTR)) {
        context.report({ node, messageId: 'noTestIdAttribute' });
        return;
      }
      if (value.includes(TEST_ATTR)) {
        context.report({ node, messageId: 'noTestAttribute' });
      }
    }

    return {
      CallExpression(node: TSESTree.CallExpression): void {
        const name = calleePropertyName(node);
        if (name === null) return;
        switch (name) {
          case 'fill':
            context.report({ node, messageId: 'noFill' });
            return;
          case 'dispatchEvent':
            context.report({ node, messageId: 'noDispatchEvent' });
            return;
          case 'click':
            // Only flag programmatic `element.click()` — Playwright's
            // `locator.click()` is fine. We discriminate by argument count:
            // Playwright's API accepts an options bag, so `locator.click()`
            // with no args looks identical to DOM's `element.click()`. To
            // avoid false positives we only flag when the callee text is
            // exactly the DOM-style pattern. We accept the conservative
            // behavior — disallow zero-arg `.click()` calls under test/ui/.
            //
            // Operators relying on `locator.click()` in Tier 2/3 should
            // prefer `page.mouse.*` for explicit pointer paths anyway. The
            // pattern this rule pushes you toward IS the spec's intent.
            if (node.arguments.length === 0) {
              context.report({ node, messageId: 'noElementClick' });
            }
            return;
          case 'getByTestId':
            context.report({ node, messageId: 'noGetByTestId' });
            return;
          default:
            return;
        }
      },

      AssignmentExpression(node: TSESTree.AssignmentExpression): void {
        if (node.operator !== '=') return;
        if (node.left.type !== AST_NODE_TYPES.MemberExpression) return;
        const name = calleePropertyName(node.left);
        if (name === 'value') {
          context.report({ node, messageId: 'noValueAssign' });
        }
      },

      Literal(node: TSESTree.Literal): void {
        const value = stringFromLiteralOrTemplate(node);
        if (value === null) return;
        reportStringNode(node, value);
      },

      TemplateLiteral(node: TSESTree.TemplateLiteral): void {
        const value = stringFromLiteralOrTemplate(node);
        if (value === null) return;
        reportStringNode(node, value);
      },
    };
  },
});
