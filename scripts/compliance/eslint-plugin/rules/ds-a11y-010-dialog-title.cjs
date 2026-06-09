/**
 * DS-A11Y-010 — Dialog/Sheet/Drawer/AlertDialog Content must have a Title.
 *
 * Every <DialogContent>, <SheetContent>, <DrawerContent>, and <AlertDialogContent>
 * must have a corresponding *Title descendant in the visible AST (counting through
 * VisuallyHidden, conditional ternaries, and && expressions).
 *
 * False-positives on wrapper components handled via waiver pragma:
 *   // q-disable-next-line DS-A11Y-010 (title rendered by <MyDialogHeader>)
 */

const { findDescendantJSX } = require('../lib/jsx-context.cjs');

const CONTENT_TO_TITLE = {
  DialogContent: 'DialogTitle',
  SheetContent: 'SheetTitle',
  DrawerContent: 'DrawerTitle',
  AlertDialogContent: 'AlertDialogTitle',
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Dialog/Sheet/Drawer/AlertDialog Content must have a Title descendant (DS-A11Y-010)',
      url: 'agent_docs/design-system.md#accessibility-mechanical-rules',
    },
    messages: {
      missingTitle:
        'DS-A11Y-010: <{{kind}}Content> must contain a <{{kind}}Title> descendant (visible or wrapped in <VisuallyHidden>) for accessibility. Radix logs a runtime warning if missing.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const tagName = node.name.name;
        const expectedTitleName = CONTENT_TO_TITLE[tagName];
        if (!expectedTitleName) return;

        // The JSXOpeningElement's parent is the JSXElement (with children)
        const parentElement = node.parent;
        if (!parentElement || parentElement.type !== 'JSXElement') return;

        const titleFound = findDescendantJSX(parentElement, (opening) => {
          return (
            opening.name.type === 'JSXIdentifier' &&
            opening.name.name === expectedTitleName
          );
        });

        if (!titleFound) {
          const kind = tagName.replace(/Content$/, '');
          context.report({
            node,
            messageId: 'missingTitle',
            data: { kind },
          });
        }
      },
    };
  },
};
