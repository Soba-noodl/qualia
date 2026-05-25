/**
 * DS-SPACING-001 — gap/space scale enforcement.
 *
 * Only spacing values in the allowed scale may be used with `gap-`,
 * `space-x-`, and `space-y-` utilities.
 *
 * Allowed scale: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16
 * Arbitrary values (gap-[...]) are caught by tailwindcss/no-arbitrary-value.
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

const ALLOWED_SCALE = new Set([
  '0', '0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16',
]);

// Matches gap-N, space-x-N, space-y-N — not arbitrary (no brackets)
const TOKEN_RE = /\b(gap|space-[xy])-(\S+)/g;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce gap/space-x/space-y values from the allowed spacing scale (DS-SPACING-001).',
    },
    schema: [],
    messages: {
      offScale:
        'DS-SPACING-001: "{{token}}" is off the spacing scale. Allowed gap/space values: 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'className') return;
        const frags = extractClassNames(node);
        for (const frag of frags) {
          if (!frag.value) continue;
          let m;
          TOKEN_RE.lastIndex = 0;
          while ((m = TOKEN_RE.exec(frag.value)) !== null) {
            const value = m[2];
            // Skip arbitrary values — handled by tailwindcss/no-arbitrary-value
            if (value.startsWith('[')) continue;
            if (!ALLOWED_SCALE.has(value)) {
              context.report({
                node: frag.node,
                messageId: 'offScale',
                data: { token: m[0] },
              });
            }
          }
        }
      },
    };
  },
};
