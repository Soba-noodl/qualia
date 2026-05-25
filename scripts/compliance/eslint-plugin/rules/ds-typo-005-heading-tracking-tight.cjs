/**
 * DS-TYPO-005 — h1/h2 elements should pair with tracking-tight.
 *
 * Every <h1> or <h2> JSX element should include the `tracking-tight` class.
 * Severity: info — flagged as a suggestion, not an error or warning.
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '<h1> and <h2> elements should include tracking-tight (DS-TYPO-005).',
    },
    schema: [],
    messages: {
      noTrackingTight:
        'DS-TYPO-005: <{{tag}}> should include "tracking-tight" for design-system typography.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (!nameNode || nameNode.type !== 'JSXIdentifier') return;
        const tag = nameNode.name;
        if (tag !== 'h1' && tag !== 'h2') return;

        // Collect all className fragments on this element
        const allFrags = [];
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (!attr.name || attr.name.name !== 'className') continue;
          allFrags.push(...extractClassNames(attr));
        }

        const hasTrackingTight = allFrags.some(
          (frag) => frag.value && /\btracking-tight\b/.test(frag.value),
        );

        if (!hasTrackingTight) {
          context.report({
            node,
            messageId: 'noTrackingTight',
            data: { tag },
          });
        }
      },
    };
  },
};
