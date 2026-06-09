/**
 * DS-COLOR-001 — No raw Tailwind palette colors in app code.
 *
 * Detects forbidden palette families on a wide set of color-prop prefixes.
 *
 * Not auto-fixable: the correct token is context-dependent (primary, accent,
 * destructive, etc.), so the rule reports without a fixer.
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

const FORBIDDEN_FAMILIES = [
  'blue',
  'indigo',
  'violet',
  'cyan',
  'sky',
  'pink',
  'purple',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'orange',
  'lime',
  'emerald',
  'teal',
  'fuchsia',
  'rose',
];

const PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'from',
  'to',
  'via',
  'fill',
  'stroke',
  'shadow',
  'outline',
  'divide',
  'placeholder',
  'caret',
  'accent',
  'decoration',
];

const PATTERN = new RegExp(
  `\\b(${PREFIXES.join('|')})-(${FORBIDDEN_FAMILIES.join('|')})-(\\d{2,3}|50)\\b`,
);

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use semantic tokens instead of raw palette colors (DS-COLOR-001).',
    },
    schema: [],
    messages: {
      noRawPalette:
        'DS-COLOR-001: raw palette color "{{match}}" — use a semantic token (primary, accent, destructive, muted, etc.).',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const nameNode = node.name;
        if (!nameNode || nameNode.name !== 'className') return;
        const fragments = extractClassNames(node);
        for (const frag of fragments) {
          if (!frag.value) continue;
          const m = frag.value.match(PATTERN);
          if (!m) continue;
          context.report({
            node: frag.node,
            messageId: 'noRawPalette',
            data: { match: m[0] },
          });
        }
      },
    };
  },
};
