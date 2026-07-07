/**
 * AST helpers for the qualia-compliance ESLint plugin.
 *
 * extractClassNames walks a JSXAttribute (typically `className=`) and pulls
 * out every static-string fragment Tailwind classes can live in. It handles:
 *   - className="literal"
 *   - className={`literal ${expr}`}     (TemplateLiteral quasis)
 *   - className={cn(...)} / clsx(...)   (recurse into CallExpression args)
 *   - className={cond ? 'a' : 'b'}      (ConditionalExpression)
 *   - className={cond && 'a'}           (LogicalExpression)
 *
 * Returns: Array<{ value: string, node: ASTNode }>
 *
 * Each entry is a single literal-string fragment with its originating AST node
 * so rules can compute precise fixer ranges.
 */
function extractClassNames(jsxAttribute) {
  if (!jsxAttribute || jsxAttribute.type !== 'JSXAttribute') return [];
  const v = jsxAttribute.value;
  if (!v) return [];

  if (v.type === 'Literal' && typeof v.value === 'string') {
    return [{ value: v.value, node: v }];
  }
  if (v.type === 'JSXExpressionContainer') {
    return extractFromExpression(v.expression);
  }
  return [];
}

function extractFromExpression(expr) {
  if (!expr) return [];
  switch (expr.type) {
    case 'Literal':
      return typeof expr.value === 'string'
        ? [{ value: expr.value, node: expr }]
        : [];
    case 'TemplateLiteral':
      // Each TemplateElement quasi is a static string fragment.
      return expr.quasis.map((q) => ({ value: q.value.cooked ?? q.value.raw ?? '', node: q }));
    case 'CallExpression':
      // cn(...), clsx(...), classnames(...) — recurse into each argument.
      return expr.arguments.flatMap((arg) => extractFromExpression(arg));
    case 'ConditionalExpression':
      return [
        ...extractFromExpression(expr.consequent),
        ...extractFromExpression(expr.alternate),
      ];
    case 'LogicalExpression':
      return [
        ...extractFromExpression(expr.left),
        ...extractFromExpression(expr.right),
      ];
    case 'ArrayExpression':
      return expr.elements.flatMap((el) => (el ? extractFromExpression(el) : []));
    case 'ObjectExpression':
      // {'foo bar': condition} — keys can be class strings.
      return expr.properties.flatMap((prop) => {
        if (prop.type === 'Property' && prop.key) {
          return extractFromExpression(prop.key);
        }
        return [];
      });
    default:
      return [];
  }
}

module.exports = { extractClassNames };
