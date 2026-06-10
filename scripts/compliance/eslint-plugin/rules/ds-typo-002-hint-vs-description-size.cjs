/**
 * DS-TYPO-002 — Hint vs description text size.
 *
 * Two passes — both heuristic, fire only when very confident:
 *   1. Element inside <FormControl> → enforce text-xs, not text-sm
 *   2. Element that is a section-description (sibling to <h2>) → enforce text-sm, not text-xs
 *
 * Severity: info (heuristic, easy to false-positive)
 *
 * NOTE: Only fires for <p> elements to keep false-positive risk low.
 * Wrapping in FormControl must be direct or at most one level deep.
 */
const { extractClassNames } = require('../lib/ast-helpers.cjs');

const TEXT_SM_RE = /\btext-sm\b/;
const TEXT_XS_RE = /\btext-xs\b/;

/**
 * Walk up the JSX tree to find an enclosing element with the given name.
 * Max depth: 10 levels.
 */
function findAncestorWithName(node, name, maxDepth = 10) {
  let current = node.parent;
  let depth = 0;
  while (current && depth < maxDepth) {
    if (
      current.type === 'JSXElement' &&
      current.openingElement &&
      current.openingElement.name &&
      current.openingElement.name.type === 'JSXIdentifier' &&
      current.openingElement.name.name === name
    ) {
      return current;
    }
    current = current.parent;
    depth++;
  }
  return null;
}

/**
 * Get sibling JSXElements of the given JSXElement node.
 */
function getSiblingElements(jsxElement) {
  const parent = jsxElement.parent;
  if (!parent) return [];
  let children;
  if (parent.type === 'JSXElement') {
    children = parent.children || [];
  } else if (parent.type === 'JSXFragment') {
    children = parent.children || [];
  } else {
    return [];
  }
  return children.filter((c) => c.type === 'JSXElement' && c !== jsxElement);
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Hint text inside FormControl should use text-xs; section descriptions should use text-sm (DS-TYPO-002).',
    },
    schema: [],
    messages: {
      hintShouldBeXs:
        'DS-TYPO-002: hint text inside <FormControl> should use text-xs, not text-sm.',
      descShouldBeSm:
        'DS-TYPO-002: section description (sibling to <h2>) should use text-sm, not text-xs.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        // Only check <p> elements — reduces false-positive risk
        if (!nameNode || nameNode.type !== 'JSXIdentifier' || nameNode.name !== 'p') return;

        const allFrags = [];
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue;
          if (!attr.name || attr.name.name !== 'className') continue;
          allFrags.push(...extractClassNames(attr));
        }

        const hasTextSm = allFrags.some((f) => f.value && TEXT_SM_RE.test(f.value));
        const hasTextXs = allFrags.some((f) => f.value && TEXT_XS_RE.test(f.value));

        // Pass 1: inside FormControl → must use text-xs
        if (hasTextSm && findAncestorWithName(node, 'FormControl')) {
          context.report({ node, messageId: 'hintShouldBeXs' });
          return;
        }

        // Pass 2: sibling to h2 → must use text-sm
        if (hasTextXs) {
          const jsxElement = node.parent; // JSXElement for this <p>
          if (!jsxElement || jsxElement.type !== 'JSXElement') return;
          const siblings = getSiblingElements(jsxElement);
          const hasH2Sibling = siblings.some(
            (sib) =>
              sib.openingElement &&
              sib.openingElement.name &&
              sib.openingElement.name.type === 'JSXIdentifier' &&
              sib.openingElement.name.name === 'h2',
          );
          if (hasH2Sibling) {
            context.report({ node, messageId: 'descShouldBeSm' });
          }
        }
      },
    };
  },
};
