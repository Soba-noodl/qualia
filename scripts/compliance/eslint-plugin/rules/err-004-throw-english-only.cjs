/**
 * ERR-004 — Thrown errors are English only (no locale strings or non-ASCII).
 *
 * new Error(...) argument should not contain non-ASCII characters.
 * Thrown errors are for developers and logs — user-facing strings belong
 * in toast/i18n pipelines, not in Error constructors.
 *
 * Severity: info (heuristic — false-positive risk on user-facing strings)
 *
 * NOTE: Does not flag Error subclasses or non-literal arguments (variable refs).
 * Only fires on `new Error("string with non-ASCII")`.
 */

// Matches any character outside printable ASCII (code points > 127)
const NON_ASCII_RE = /[^\x00-\x7F]/;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'new Error() arguments must not contain non-ASCII characters (ERR-004).',
    },
    schema: [],
    messages: {
      nonAsciiError:
        'ERR-004: new Error() argument contains non-ASCII characters — thrown errors are for developers, not end users. Use a locale-aware toast/notification instead.',
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (!arg || arg.type !== 'NewExpression') return;
        if (!arg.callee || arg.callee.type !== 'Identifier' || arg.callee.name !== 'Error') return;

        const firstArg = arg.arguments && arg.arguments[0];
        if (!firstArg) return;

        // String literal
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          if (NON_ASCII_RE.test(firstArg.value)) {
            context.report({ node, messageId: 'nonAsciiError' });
          }
          return;
        }

        // Template literal — check each quasi (static part)
        if (firstArg.type === 'TemplateLiteral') {
          for (const quasi of firstArg.quasis || []) {
            const raw = quasi.value && (quasi.value.cooked ?? quasi.value.raw ?? '');
            if (raw && NON_ASCII_RE.test(raw)) {
              context.report({ node, messageId: 'nonAsciiError' });
              return;
            }
          }
        }
      },
    };
  },
};
