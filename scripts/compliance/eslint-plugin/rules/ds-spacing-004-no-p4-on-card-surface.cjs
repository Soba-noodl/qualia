/**
 * DS-SPACING-004 — Card/glass surface uses p-5 or p-6, not p-4.
 *
 * <Card> components and elements with a glass token in className should use
 * p-5 or p-6 for inner padding, not p-4.
 *
 * Severity: warn
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

// Matches p-4 but not p-4.5, p-14, p-24, etc.
const P4_RE = /\bp-4\b/;
const GLASS_RE = /\bglass\b/;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Card and glass surfaces should use p-5 or p-6, not p-4 (DS-SPACING-004).',
    },
    schema: [],
    messages: {
      noP4:
        'DS-SPACING-004: "p-4" on {{surface}} surface — use p-5 or p-6 for Card/glass surfaces.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (!nameNode) return;

        const isCard = nameNode.type === 'JSXIdentifier' && nameNode.name === 'Card';

        // Collect all className fragments to check for glass token and p-4
        const allFrags = [];
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (!attr.name || attr.name.name !== 'className') continue;
          allFrags.push(...extractClassNames(attr));
        }

        const hasGlass = allFrags.some((frag) => frag.value && GLASS_RE.test(frag.value));
        const hasP4 = allFrags.some((frag) => frag.value && P4_RE.test(frag.value));

        if ((isCard || hasGlass) && hasP4) {
          context.report({
            node,
            messageId: 'noP4',
            data: { surface: isCard ? 'Card' : 'glass' },
          });
        }
      },
    };
  },
};
