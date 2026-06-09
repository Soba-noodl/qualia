/**
 * Shared JSX context helpers for the qualia-compliance ESLint plugin.
 * Used by rules that need cross-attribute or sibling-element awareness.
 */
const { extractClassNames } = require('./ast-helpers.cjs');

/**
 * Returns true if any className value on the JSX opening element matches the regex.
 * Walks all JSXAttribute[name.name="className"] literal/template parts including
 * cn()/clsx() args via extractClassNames.
 *
 * @param {import('estree-jsx').JSXOpeningElement} jsxOpeningElement
 * @param {RegExp} regex
 * @returns {boolean}
 */
function classNameMatches(jsxOpeningElement, regex) {
  if (!jsxOpeningElement || !jsxOpeningElement.attributes) return false;
  for (const attr of jsxOpeningElement.attributes) {
    if (attr.type !== 'JSXAttribute') continue;
    if (!attr.name || attr.name.name !== 'className') continue;
    const frags = extractClassNames(attr);
    for (const frag of frags) {
      if (frag.value && regex.test(frag.value)) return true;
    }
  }
  return false;
}

/**
 * Returns the nearest ancestor JSXElement of the given node, or null.
 *
 * @param {import('eslint').Rule.Node} node
 * @returns {import('estree-jsx').JSXElement | null}
 */
function findEnclosingJSXElement(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'JSXElement') return current;
    current = current.parent;
  }
  return null;
}

/**
 * Returns true if the JSX opening element's name matches one of the provided names.
 * Handles both plain identifiers (<Card>) and member expressions (<Foo.Bar> → 'Foo.Bar').
 *
 * @param {import('estree-jsx').JSXOpeningElement} jsxOpeningElement
 * @param {string[]} names
 * @returns {boolean}
 */
function isElementOneOf(jsxOpeningElement, names) {
  if (!jsxOpeningElement || !jsxOpeningElement.name) return false;
  const nameNode = jsxOpeningElement.name;
  let elementName;
  if (nameNode.type === 'JSXIdentifier') {
    elementName = nameNode.name;
  } else if (nameNode.type === 'JSXMemberExpression') {
    elementName = `${nameNode.object.name}.${nameNode.property.name}`;
  } else {
    return false;
  }
  return names.includes(elementName);
}

/**
 * Returns sibling JSXElement nodes at the same parent depth, optionally filtered.
 * Siblings are other children of the same parent JSXElement.
 *
 * @param {import('eslint').Rule.Node} node - a JSXOpeningElement or JSXElement
 * @param {(sibling: import('estree-jsx').JSXElement) => boolean} [filter]
 * @returns {import('estree-jsx').JSXElement[]}
 */
function findSiblings(node, filter) {
  // Normalize: accept either JSXOpeningElement or JSXElement
  const jsxElement =
    node.type === 'JSXElement' ? node : node.parent;

  if (!jsxElement || jsxElement.type !== 'JSXElement') return [];

  const parentElement = jsxElement.parent;
  if (!parentElement) return [];

  // Get all JSXElement children of the parent
  let children;
  if (parentElement.type === 'JSXElement') {
    children = parentElement.children || [];
  } else if (parentElement.type === 'JSXFragment') {
    children = parentElement.children || [];
  } else {
    return [];
  }

  const siblings = children.filter(
    (child) => child.type === 'JSXElement' && child !== jsxElement,
  );

  return filter ? siblings.filter(filter) : siblings;
}

/**
 * Depth-first search through JSX descendants. Walks both branches of
 * conditional/logical expressions, into fragments, and into nested elements.
 * Returns the first descendant openingElement where predicate(openingElement)
 * is truthy, or null.
 *
 * @param {import('estree-jsx').JSXElement | import('estree-jsx').JSXFragment | import('eslint').Rule.Node} node
 * @param {(openingElement: import('estree-jsx').JSXOpeningElement) => boolean} predicate
 * @returns {import('estree-jsx').JSXOpeningElement | null}
 */
function findDescendantJSX(node, predicate) {
  if (!node) return null;

  // Direct match: this node is a JSXElement whose opening matches
  if (node.type === 'JSXElement' && predicate(node.openingElement)) {
    return node.openingElement;
  }

  // Walk children of JSXElement / JSXFragment
  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    for (const child of node.children || []) {
      const found = findDescendantJSX(child, predicate);
      if (found) return found;
    }
  }

  // JSXExpressionContainer wraps an expression that may contain JSX
  if (node.type === 'JSXExpressionContainer') {
    return findDescendantJSX(node.expression, predicate);
  }

  // Conditional: walk both branches
  if (node.type === 'ConditionalExpression') {
    return (
      findDescendantJSX(node.consequent, predicate) ||
      findDescendantJSX(node.alternate, predicate)
    );
  }

  // Logical: walk both sides (covers && and ||)
  if (node.type === 'LogicalExpression') {
    return (
      findDescendantJSX(node.left, predicate) ||
      findDescendantJSX(node.right, predicate)
    );
  }

  return null;
}

module.exports = { classNameMatches, findEnclosingJSXElement, isElementOneOf, findSiblings, findDescendantJSX };
