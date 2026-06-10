/**
 * DS-SPACING-005 — <Label> + input pairing uses space-y-1.5 or space-y-2.
 *
 * When a <Label> and an <Input>, <Textarea>, or <Select> share the same parent,
 * the parent should have `space-y-1.5` or `space-y-2` in its className,
 * not `space-y-3` or other values.
 *
 * Severity: info (heuristic — fires when the pattern is very clear)
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

const INPUT_NAMES = new Set(['Input', 'Textarea', 'Select']);
const SPACE_Y_RE = /\bspace-y-(\S+)\b/g;
const ALLOWED_SPACE_Y = new Set(['1.5', '2']);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '<Label> + input pairing parent should use space-y-1.5 or space-y-2, not other values (DS-SPACING-005).',
    },
    schema: [],
    messages: {
      wrongSpacingY:
        'DS-SPACING-005: Label+input parent has "space-y-{{value}}" — use space-y-1.5 or space-y-2.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        // Only trigger on <Label>
        if (!nameNode || nameNode.type !== 'JSXIdentifier' || nameNode.name !== 'Label') return;

        const jsxElement = node.parent; // The JSXElement for <Label>
        if (!jsxElement || jsxElement.type !== 'JSXElement') return;

        const parentElement = jsxElement.parent;
        if (!parentElement || parentElement.type !== 'JSXElement') return;

        // Check if there's a sibling input element
        const siblings = (parentElement.children || []).filter(
          (c) => c.type === 'JSXElement' && c !== jsxElement,
        );
        const hasInputSibling = siblings.some((sib) => {
          const sibName = sib.openingElement && sib.openingElement.name;
          return (
            sibName &&
            sibName.type === 'JSXIdentifier' &&
            INPUT_NAMES.has(sibName.name)
          );
        });

        if (!hasInputSibling) return;

        // Check parent's className for space-y-*
        const parentOpener = parentElement.openingElement;
        if (!parentOpener) return;

        const allFrags = [];
        for (const attr of parentOpener.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (!attr.name || attr.name.name !== 'className') continue;
          allFrags.push(...extractClassNames(attr));
        }

        for (const frag of allFrags) {
          if (!frag.value) continue;
          let m;
          SPACE_Y_RE.lastIndex = 0;
          while ((m = SPACE_Y_RE.exec(frag.value)) !== null) {
            const value = m[1];
            if (!ALLOWED_SPACE_Y.has(value)) {
              context.report({
                node: parentOpener,
                messageId: 'wrongSpacingY',
                data: { value },
              });
            }
          }
        }
      },
    };
  },
};
