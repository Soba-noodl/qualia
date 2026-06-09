/**
 * ERR-003 — useMutation onError required.
 *
 * Every useMutation call must pass an options object that includes
 * an `onError` property. Without it, mutation failures are silently
 * swallowed.
 *
 * Severity: warn
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'useMutation options must include an onError handler (ERR-003).',
    },
    schema: [],
    messages: {
      missingOnError:
        'ERR-003: useMutation is missing an "onError" handler — mutation failures will be silently swallowed.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!node.callee || node.callee.type !== 'Identifier' || node.callee.name !== 'useMutation') {
          return;
        }

        // useMutation can be called as useMutation(options) or useMutation(mutationFn, options)
        // Find the options object argument
        let optionsArg = null;
        for (const arg of node.arguments) {
          if (arg.type === 'ObjectExpression') {
            optionsArg = arg;
            break;
          }
        }

        if (!optionsArg) {
          // No options object at all → report
          context.report({ node, messageId: 'missingOnError' });
          return;
        }

        // Check if onError property exists
        const hasOnError = optionsArg.properties.some(
          (prop) =>
            prop.type === 'Property' &&
            prop.key &&
            ((prop.key.type === 'Identifier' && prop.key.name === 'onError') ||
              (prop.key.type === 'Literal' && prop.key.value === 'onError')),
        );

        if (!hasOnError) {
          context.report({ node, messageId: 'missingOnError' });
        }
      },
    };
  },
};
