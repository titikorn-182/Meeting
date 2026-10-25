import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const sourceRoot = resolve('src');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
test('production modules cannot import demo code except the explicit lazy adapter boundary', () => {
  const violations: string[] = [];
  for (const filename of files(sourceRoot).filter(
    (file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'),
  )) {
    const name = relative(sourceRoot, filename).replaceAll('\\', '/');
    if (name.startsWith('demo/')) continue;
    const tree = ts.createSourceFile(
      filename,
      readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function inspect(node: ts.Node) {
      let specifier: ts.Expression | undefined;
      let dynamic = false;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        specifier = node.arguments[0];
        dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      }
      if (specifier && ts.isStringLiteral(specifier)) {
        const target = specifier.text.startsWith('@/')
          ? resolve(sourceRoot, specifier.text.slice(2))
          : specifier.text.startsWith('.')
            ? resolve(dirname(filename), specifier.text)
            : '';
        const targetName = relative(sourceRoot, target).replaceAll('\\', '/');
        const allowed =
          name === 'providers/workspace-provider.tsx' &&
          dynamic &&
          targetName === 'demo/demo-workspace-provider';
        if (targetName.startsWith('demo/') && !allowed)
          violations.push(`${name}: ${specifier.text}`);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(tree);
  }
  assert.deepEqual(violations, []);
});
