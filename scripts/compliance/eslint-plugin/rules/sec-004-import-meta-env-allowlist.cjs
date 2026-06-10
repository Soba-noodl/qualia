/**
 * SEC-004 — import.meta.env only via known allow-list.
 *
 * Property accesses on `import.meta.env` whose name does not match
 * the allow-list are flagged.
 *
 * Allow-list:
 *   - Vite built-ins: MODE, DEV, PROD, SSR, BASE_URL
 *   - Project VITE_* vars from .env.example
 *   - The two unlabelled PostHog vars that are accessed in src/lib/posthog.ts
 *     without VITE_ prefix (POSTHOG_KEY, POSTHOG_HOST, POSTHOG_API_KEY)
 *
 * Severity: warn
 */

const ALLOW_LIST = new Set([
  // Vite built-ins
  'MODE',
  'DEV',
  'PROD',
  'SSR',
  'BASE_URL',
  // Project vars
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PROJECT_ID',
  'VITE_POSTHOG_KEY',
  'VITE_POSTHOG_HOST',
  'VITE_GOOGLE_APP_ID',
  'VITE_GOOGLE_API_KEY',
  'VITE_ENABLE_AUTO_AUDIT',
  'VITE_ENABLE_PROTOTYPE_AUDIT',
  // Legacy / unlabelled variants used in posthog.ts
  'POSTHOG_KEY',
  'POSTHOG_HOST',
  'POSTHOG_API_KEY',
]);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'import.meta.env property accesses must be in the known allow-list (SEC-004).',
    },
    schema: [],
    messages: {
      unknownEnvVar:
        'SEC-004: "import.meta.env.{{name}}" is not in the allow-list. Add it to .env.example and the SEC-004 allow-list.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        // import.meta.env.X — the outer MemberExpression is .X on import.meta.env
        // AST shape: MemberExpression { object: MemberExpression { object: MetaProperty, property: Identifier(env) }, property: Identifier(X) }
        if (
          node.object &&
          node.object.type === 'MemberExpression' &&
          node.object.object &&
          node.object.object.type === 'MetaProperty' &&
          node.object.object.meta &&
          node.object.object.meta.name === 'import' &&
          node.object.object.property &&
          node.object.object.property.name === 'meta' &&
          node.object.property &&
          node.object.property.name === 'env'
        ) {
          const prop = node.property;
          // Only flag static accesses (Identifier or string Literal)
          if (prop.type === 'Identifier') {
            if (!ALLOW_LIST.has(prop.name)) {
              context.report({
                node,
                messageId: 'unknownEnvVar',
                data: { name: prop.name },
              });
            }
          } else if (prop.type === 'Literal' && typeof prop.value === 'string') {
            if (!ALLOW_LIST.has(prop.value)) {
              context.report({
                node,
                messageId: 'unknownEnvVar',
                data: { name: prop.value },
              });
            }
          }
        }
      },
    };
  },
};
