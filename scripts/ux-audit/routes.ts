/**
 * Route discovery — parses an entry App.tsx (or similar) to find
 * <Route path="..." element={<X />} /> tuples and resolves the
 * element identifier back to its source file.
 *
 * Uses ts-morph for AST traversal so JSX edge-cases are handled.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Project, SyntaxKind, Node } from 'ts-morph';

export interface DiscoveredRoute {
  path: string;
  elementName: string;
  elementFile: string | null;
}

const PROJECT_ALIAS = '@/';

export function discoverRoutes(entryFile: string, repoRoot: string): DiscoveredRoute[] {
  if (!existsSync(entryFile)) return [];
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  let sf;
  try {
    sf = project.addSourceFileAtPath(entryFile);
  } catch {
    return [];
  }

  // Build import map: identifier name → resolved file path (when resolvable).
  const importMap = new Map<string, string>();
  for (const imp of sf.getImportDeclarations()) {
    const moduleSpec = imp.getModuleSpecifierValue();
    const resolved = resolvePath(moduleSpec, entryFile, repoRoot);
    const def = imp.getDefaultImport();
    if (def) importMap.set(def.getText(), resolved ?? '');
    for (const named of imp.getNamedImports()) {
      importMap.set(named.getName(), resolved ?? '');
    }
  }

  // Find all <Route ...> JSX nodes.
  const routes: DiscoveredRoute[] = [];
  sf.forEachDescendant((node) => {
    if (!Node.isJsxSelfClosingElement(node) && !Node.isJsxOpeningElement(node)) return;
    const tagName = node.getTagNameNode().getText();
    if (tagName !== 'Route') return;

    const attrs = node.getAttributes();
    let pathVal: string | null = null;
    let elementName: string | null = null;

    for (const attr of attrs) {
      if (!Node.isJsxAttribute(attr)) continue;
      const name = attr.getNameNode().getText();
      const init = attr.getInitializer();
      if (!init) continue;
      if (name === 'path') {
        if (Node.isStringLiteral(init)) pathVal = init.getLiteralValue();
        else if (Node.isJsxExpression(init)) {
          const expr = init.getExpression();
          if (expr && Node.isStringLiteral(expr)) pathVal = expr.getLiteralValue();
        }
      } else if (name === 'element') {
        if (Node.isJsxExpression(init)) {
          const expr = init.getExpression();
          if (expr) {
            // Look for the first JSX element inside (e.g. <DashboardPage />)
            const inner = expr.getFirstDescendantByKind(SyntaxKind.JsxSelfClosingElement)
              ?? expr.getFirstDescendantByKind(SyntaxKind.JsxOpeningElement)
              ?? (Node.isJsxSelfClosingElement(expr) || Node.isJsxOpeningElement(expr) ? expr : undefined);
            if (inner && (Node.isJsxSelfClosingElement(inner) || Node.isJsxOpeningElement(inner))) {
              elementName = inner.getTagNameNode().getText();
            } else if (Node.isIdentifier(expr)) {
              elementName = expr.getText();
            }
          }
        }
      }
    }

    if (pathVal !== null) {
      routes.push({
        path: pathVal,
        elementName: elementName ?? '<unknown>',
        elementFile: elementName ? (importMap.get(elementName) || null) : null,
      });
    }
  });

  return routes;
}

function resolvePath(spec: string, fromFile: string, repoRoot: string): string | null {
  if (!spec.startsWith('.') && !spec.startsWith(PROJECT_ALIAS)) return null;
  let base: string;
  if (spec.startsWith(PROJECT_ALIAS)) {
    base = join(repoRoot, 'src', spec.slice(PROJECT_ALIAS.length));
  } else {
    base = resolve(dirname(fromFile), spec);
  }
  const candidates = [
    base,
    base + '.ts',
    base + '.tsx',
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}
