import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const API_SRC = join(REPO_ROOT, "apps/api/src");
const SDK_SRC = join(REPO_ROOT, "packages/sdk/src");

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist") return [];
    if (statSync(full).isDirectory()) return walk(full, exts);
    return exts.some((e) => full.endsWith(e)) ? [full] : [];
  });
}

function literalOf(node: ts.Node | undefined): string {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return "";
}

/** Every route the API serves, as `METHOD /path` with `:param` normalised away. */
function apiRoutes(): Set<string> {
  const routes = new Set<string>();

  for (const file of walk(API_SRC, [".ts"])) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;

      let base = "";

      const visit = (node: ts.Node) => {
        if (ts.isDecorator(node) && ts.isCallExpression(node.expression)) {
          const name = node.expression.expression.getText(source);

          if (name === "Controller") {
            base = literalOf(node.expression.arguments[0]).replace(/^\/+|\/+$/g, "");
          }

          if (["Get", "Post", "Put", "Patch", "Delete"].includes(name)) {
            const sub = (literalOf(node.expression.arguments[0]) || "").replace(/^\/+|\/+$/g, "");
            const full = `/${base}/${sub}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
            routes.add(`${name.toUpperCase()} ${full.replace(/:[^/]+/g, ":")}`);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(statement);
    }
  }

  return routes;
}

/**
 * Resolve `${this.helper(a, b)}` inside a template literal by finding the helper's
 * single `return \`...\`` and substituting its parameters with `:`. Without this the
 * SDK can hide its paths behind a `base()` helper and the checker goes blind.
 */
function resolveHelper(source: ts.SourceFile, name: string): string | null {
  let found: string | null = null;

  const walk = (node: ts.Node) => {
    if (
      ts.isMethodDeclaration(node) &&
      node.name.getText(source) === name &&
      node.body &&
      ts.isBlock(node.body)
    ) {
      for (const statement of node.body.statements) {
        if (
          ts.isReturnStatement(statement) &&
          statement.expression &&
          ts.isTemplateExpression(statement.expression)
        ) {
          let rendered = statement.expression.head.text;
          for (const span of statement.expression.templateSpans) {
            rendered += ":" + span.literal.text;
          }
          found = rendered;
        }
      }
    }
    ts.forEachChild(node, walk);
  };

  walk(source);
  return found;
}

/** Collapse every param position to a single `:` so sdk and api paths compare. */
function normalise(path: string): string {
  return path
    .replace(/\$\{[^}]+\}/g, ":")
    .replace(/:+/g, ":")
    .replace(/\/$/, "");
}

function renderTemplate(source: ts.SourceFile, node: ts.Expression): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;

  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const expr = span.expression;

      if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        expr.expression.expression.getText(source) === "this"
      ) {
        out += resolveHelper(source, expr.expression.name.getText(source)) ?? ":";
      } else {
        out += ":";
      }

      out += span.literal.text;
    }
    return out;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    ts.isStringLiteral(node.left)
  ) {
    return node.left.text;
  }

  return "";
}

/** Every endpoint the SDK calls, with its file, as `METHOD /path`. */
function sdkEndpoints(): Array<{ file: string; method: string; path: string }> {
  const calls: Array<{ file: string; method: string; path: string }> = [];

  for (const file of walk(SDK_SRC, [".ts"])) {
    const relative = file.replace(`${SDK_SRC}/`, "");
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression)
      ) {
        const http = node.expression;
        const holder = http.expression;

        if (
          holder.expression.getText(source) === "this" &&
          holder.name.getText(source) === "client"
        ) {
          const method = http.name.getText(source).toUpperCase();
          const raw = node.arguments[0] ? renderTemplate(source, node.arguments[0]) : "";

          if (raw) {
            calls.push({
              file: relative,
              method,
              path: normalise(raw),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return calls;
}

describe("sdk endpoint drift", () => {
  const routes = apiRoutes();

  it("the api route table is non-empty", () => {
    expect(routes.size).toBeGreaterThan(100);
  });

  it("actually finds the sdk endpoints", () => {
    // Guards against the extractor silently matching nothing, which would make
    // the drift assertion below pass vacuously.
    expect(sdkEndpoints().length).toBeGreaterThan(15);
  });

  it("every sdk endpoint resolves to a route the api serves", () => {
    const dead = sdkEndpoints()
      .filter((e) => !routes.has(`${e.method} ${e.path}`))
      .map((e) => `${e.method} ${e.path}  (${e.file})`);

    expect(dead, `sdk endpoints the api does not serve:\n${dead.join("\n")}`).toEqual([]);
  });
});
