/**
 * DS-PRIMITIVE-009 — Confirmation flows use <AlertDialog>.
 *
 * If a <Dialog> contains a <Button variant="destructive"> whose text content
 * matches /Delete|Remove|Discard/, recommend using <AlertDialog> instead.
 *
 * Severity: warn
 * False-positive risk: low — fires only for the specific text+variant combo.
 */

const DESTRUCTIVE_TEXT_RE = /\b(Delete|Remove|Discard)\b/;

/**
 * Get all JSXText content within a JSXElement (recursive).
 */
function collectText(node) {
  if (!node) return '';
  if (node.type === 'JSXText') return node.value;
  if (node.type === 'JSXElement') {
    return (node.children || []).map(collectText).join('');
  }
  return '';
}

/**
 * Recursively search for Button elements with variant="destructive" and destructive text.
 */
function findDestructiveButton(node) {
  if (!node || node.type !== 'JSXElement') return false;

  const opener = node.openingElement;
  if (opener && opener.name && opener.name.type === 'JSXIdentifier' && opener.name.name === 'Button') {
    const isDestructive = opener.attributes.some(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        attr.name &&
        attr.name.name === 'variant' &&
        attr.value &&
        ((attr.value.type === 'Literal' && attr.value.value === 'destructive') ||
          (attr.value.type === 'JSXExpressionContainer' &&
            attr.value.expression &&
            attr.value.expression.type === 'Literal' &&
            attr.value.expression.value === 'destructive')),
    );
    if (isDestructive) {
      const text = collectText(node);
      if (DESTRUCTIVE_TEXT_RE.test(text)) return true;
    }
  }

  // Recurse into children
  for (const child of node.children || []) {
    if (findDestructiveButton(child)) return true;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Destructive confirmation flows inside <Dialog> should use <AlertDialog> instead (DS-PRIMITIVE-009).',
    },
    schema: [],
    messages: {
      useAlertDialog:
        'DS-PRIMITIVE-009: <Dialog> contains a destructive action ("{{text}}") — use <AlertDialog> for destructive confirmations.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (!nameNode || nameNode.type !== 'JSXIdentifier' || nameNode.name !== 'Dialog') return;

        const jsxElement = node.parent;
        if (!jsxElement || jsxElement.type !== 'JSXElement') return;

        if (findDestructiveButton(jsxElement)) {
          // Find the matching text for the message
          const match = collectText(jsxElement).match(DESTRUCTIVE_TEXT_RE);
          context.report({
            node,
            messageId: 'useAlertDialog',
            data: { text: match ? match[0] : 'destructive action' },
          });
        }
      },
    };
  },
};
