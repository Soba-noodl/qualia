/**
 * DS-COLOR-002 — Warning color is amber, never yellow.
 *
 * Detects `bg-yellow-*`, `text-yellow-*`, `border-yellow-*`, `ring-yellow-*`,
 * `fill-yellow-*`, `stroke-yellow-*`, `from-yellow-*`, `to-yellow-*`,
 * `via-yellow-*` in className strings.
 *
 * Auto-fixable: replace `<prefix>-yellow-` → `<prefix>-amber-`.
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

const PATTERN = /\b(bg|text|border|ring|fill|stroke|from|to|via)-yellow-(\d{2,3}|50)\b/g;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use amber instead of yellow for warning states (DS-COLOR-002).',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noYellow: 'DS-COLOR-002: use `amber-*` instead of `yellow-*` for warning states.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const nameNode = node.name;
        if (!nameNode || nameNode.name !== 'className') return;
        const fragments = extractClassNames(node);
        for (const frag of fragments) {
          if (!frag.value || !PATTERN.test(frag.value)) {
            // Reset state — `g` flag stickiness would otherwise break .test()
            PATTERN.lastIndex = 0;
            continue;
          }
          PATTERN.lastIndex = 0;
          context.report({
            node: frag.node,
            messageId: 'noYellow',
            fix(fixer) {
              const sourceCode = context.getSourceCode();
              const text = sourceCode.getText(frag.node);
              const fixed = text.replace(
                /\b(bg|text|border|ring|fill|stroke|from|to|via)-yellow-/g,
                '$1-amber-',
              );
              if (fixed === text) return null;
              return fixer.replaceText(frag.node, fixed);
            },
          });
        }
      },
    };
  },
};
