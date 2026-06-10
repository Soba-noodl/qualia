/**
 * EFFECT-001 — useEffect cleanup mandatory for intervals/timeouts/listeners.
 *
 * If a useEffect callback uses setInterval, setTimeout, addEventListener,
 * or any .subscribe(...) call, it must return a cleanup function.
 *
 * Severity: error (this is a real memory-leak class)
 *
 * "Cleanup" means any return statement that returns a function or a value
 * (we accept any returned value as a cleanup to avoid false positives when
 * cleanup is delegated to a helper).
 */

/**
 * Collect identifiers/method names called in a function body.
 * Returns a Set of strings like 'setInterval', 'setTimeout', 'addEventListener', 'subscribe'.
 */
function collectLeakyCallsInBody(body) {
  const found = new Set();
  if (!body) return found;

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee) {
        if (callee.type === 'Identifier') {
          const name = callee.name;
          if (name === 'setInterval' || name === 'setTimeout') {
            found.add(name);
          }
        } else if (callee.type === 'MemberExpression' && callee.property) {
          const prop = callee.property.name;
          if (prop === 'addEventListener' || prop === 'subscribe') {
            found.add(prop);
          }
        }
      }
    }
    // Recurse
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(body);
  return found;
}

/**
 * Returns true if the function body has at least one ReturnStatement that returns
 * a non-void value (function, identifier, call expression, etc.).
 * We accept any return value as "cleanup present" to minimize false positives.
 */
function hasReturnWithValue(body) {
  if (!body || body.type !== 'BlockStatement') return false;
  function findReturn(stmts) {
    for (const stmt of stmts || []) {
      if (stmt.type === 'ReturnStatement' && stmt.argument !== null && stmt.argument !== undefined) {
        return true;
      }
      // Walk nested blocks but not nested function bodies
      if (stmt.type === 'BlockStatement' && findReturn(stmt.body)) return true;
      if (stmt.type === 'IfStatement') {
        if (
          (stmt.consequent && findReturn(
            stmt.consequent.type === 'BlockStatement' ? stmt.consequent.body : [stmt.consequent],
          )) ||
          (stmt.alternate && findReturn(
            stmt.alternate.type === 'BlockStatement' ? stmt.alternate.body : [stmt.alternate],
          ))
        ) {
          return true;
        }
      }
    }
    return false;
  }
  return findReturn(body.body);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'useEffect callbacks using setInterval/setTimeout/addEventListener/.subscribe must return a cleanup function (EFFECT-001).',
    },
    schema: [],
    messages: {
      missingCleanup:
        'EFFECT-001: useEffect uses {{calls}} but does not return a cleanup function — this will cause a memory leak.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== 'Identifier' || node.callee.name !== 'useEffect') {
          return;
        }

        // First argument is the effect callback
        const callback = node.arguments[0];
        if (!callback) return;

        let body = null;
        if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
          body = callback.body;
        }
        if (!body) return;

        // If the arrow has a concise body (expression, not block), skip
        if (body.type !== 'BlockStatement') return;

        const leakyCalls = collectLeakyCallsInBody(body);
        if (leakyCalls.size === 0) return;

        if (!hasReturnWithValue(body)) {
          context.report({
            node,
            messageId: 'missingCleanup',
            data: { calls: [...leakyCalls].join(', ') },
          });
        }
      },
    };
  },
};
