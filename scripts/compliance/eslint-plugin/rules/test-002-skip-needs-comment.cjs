/**
 * TEST-002 — .skip requires a comment with a ticket or reason.
 *
 * Any `it.skip`, `describe.skip`, or `test.skip` in its test-declaration form
 * (first arg is a string description, second is a callback) must have a comment
 * on the line immediately above it containing one of:
 *   - SKIP: <reason>
 *   - TODO(@<user>)
 *   - A JIRA/GitHub-style ticket reference (letters-digits, e.g. JIRA-123, GH-42)
 *   - A date (YYYY-MM-DD or DD/MM/YYYY)
 *
 * Does NOT fire on the programmatic form `test.skip(true, reason)` — that form
 * has its own inline justification in the second argument.
 *
 * Severity: warn
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '.skip without an explanatory comment is not allowed (TEST-002).',
    },
    schema: [],
    messages: {
      noComment:
        'TEST-002: "{{obj}}.skip" requires a comment above it with a ticket or reason (e.g. "// SKIP: reason", "// TODO(@user)", "// PROJ-123").',
    },
  },
  create(context) {
    // Pattern that a sufficient comment must match
    const REASON_RE = /(?:SKIP:|TODO\(@\w+\)|[A-Z]+-\d+|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/;

    return {
      'MemberExpression[property.name="skip"]'(node) {
        const obj = node.object;
        if (!obj || obj.type !== 'Identifier') return;
        if (!['it', 'describe', 'test'].includes(obj.name)) return;

        // Only fire on the declaration form: .skip("description", callback)
        // The parent should be a CallExpression, and the first argument must be a string literal.
        const callExpr = node.parent;
        if (!callExpr || callExpr.type !== 'CallExpression') return;
        if (callExpr.callee !== node) return;

        const firstArg = callExpr.arguments[0];
        // If the first argument is NOT a string literal, this is the programmatic form
        // (e.g. test.skip(true, reason)) — do not flag.
        if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return;

        // The skip call line number
        const callLine = node.loc && node.loc.start.line;
        if (!callLine) return;

        // Check for comments on the line immediately above
        const sourceCode = context.getSourceCode
          ? context.getSourceCode()
          : context.sourceCode;
        const comments = sourceCode.getAllComments();
        const hasReason = comments.some((comment) => {
          const commentLine = comment.loc && comment.loc.end.line;
          // Comment must end on the line just before the skip call
          if (commentLine !== callLine - 1) return false;
          return REASON_RE.test(comment.value);
        });

        if (!hasReason) {
          context.report({
            node,
            messageId: 'noComment',
            data: { obj: obj.name },
          });
        }
      },
    };
  },
};
