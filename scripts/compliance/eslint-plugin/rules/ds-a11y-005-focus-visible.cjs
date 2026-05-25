/**
 * DS-A11Y-005 — Custom click targets need focus-visible styling.
 *
 * Any lowercase HTML element (div, span, li, a, etc.) with an onClick handler
 * must include a focus-visible: class somewhere in its className. Capitalized
 * components are exempt — they're trusted to handle their own focus.
 *
 * Pairs with the clickableProps() helper update: callers using the helper
 * auto-comply because the helper now returns a focus-visible className.
 */

const { extractClassNames } = require('../lib/ast-helpers.cjs');

// HTML elements that can be turned into click targets without inheriting
// browser/<Button>-provided focus styling. Lowercase only; capitalized
// components are trusted to handle their own focus.
// Explicitly excludes 'button' and 'input' which get focus-visible from the browser.
const LOWERCASE_INTERACTIVE_ALLOWLIST = new Set([
  'div', 'span', 'li', 'a', 'tr', 'td', 'th',
  'article', 'section', 'nav', 'header', 'footer', 'aside',
  'figure', 'label', 'summary',
]);

const FOCUS_VISIBLE_PATTERN = /\bfocus-visible:/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Custom click targets need focus-visible styling (DS-A11Y-005)',
      url: 'agent_docs/design-system.md#accessibility-mechanical-rules',
    },
    messages: {
      noFocusVisible:
        'DS-A11Y-005: Custom click target needs focus-visible styling. Add a focus-visible:* class (e.g. focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2), or use clickableProps() from @/lib/a11y which provides it.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        // Lowercase element names only
        if (node.name.type !== 'JSXIdentifier') return;
        const tagName = node.name.name;
        if (!LOWERCASE_INTERACTIVE_ALLOWLIST.has(tagName)) return;

        // Must have onClick attribute
        const hasOnClick = node.attributes.some(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.name === 'onClick'
        );
        if (!hasOnClick) return;

        // Collect every className value contributed
        const classNameAttr = node.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name &&
            attr.name.name === 'className'
        );
        const values = classNameAttr ? extractClassNames(classNameAttr) : [];

        // Check whether any contributing string contains focus-visible:
        const hasFocusVisible = values.some(({ value }) =>
          FOCUS_VISIBLE_PATTERN.test(value)
        );

        if (!hasFocusVisible) {
          context.report({
            node,
            messageId: 'noFocusVisible',
          });
        }
      },
    };
  },
};
