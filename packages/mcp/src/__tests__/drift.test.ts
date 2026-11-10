import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { OPERATION_BINDINGS } from "../manifest.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const API_SRC = join(REPO_ROOT, "apps/api/src");
const SPEC = join(REPO_ROOT, "docs/openapi/openapi.json");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist") return [];
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function literalOf(node: ts.Node | undefined): string {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return "";
}

function apiRoutes(): Set<string> {
  const routes = new Set<string>();

  for (const file of walk(API_SRC)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    let base = "";

    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;

      const visit = (node: ts.Node) => {
        if (ts.isDecorator(node) && ts.isCallExpression(node.expression)) {
          const name = node.expression.expression.getText(source);

          if (name === "Controller") {
            base = literalOf(node.expression.arguments[0]).replace(/^\/+|\/+$/g, "");
          }

          if (["Get", "Post", "Put", "Patch", "Delete"].includes(name)) {
            const sub = (literalOf(node.expression.arguments[0]) || "").replace(/^\/+|\/+$/g, "");
            const full = `/${base}/${sub}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
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

function specOperations(): Set<string> {
  const spec = JSON.parse(readFileSync(SPEC, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const ops = new Set<string>();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      ops.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return ops;
}

describe("openapi drift", () => {
  const spec = specOperations();
  const routes = apiRoutes();

  it("parses the spec and the api routes", () => {
    expect(spec.size).toBeGreaterThan(0);
    expect(routes.size).toBeGreaterThan(0);
  });

  it("exposes every spec operation through exactly one tool", () => {
    const covered = new Set(OPERATION_BINDINGS.map((b) => `${b.method} ${b.specPath}`));
    const missing = [...spec].filter((op) => !covered.has(op));

    expect(missing, `spec operations with no MCP tool: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no manifest entry for an operation the spec does not publish", () => {
    const stale = OPERATION_BINDINGS.filter((b) => !spec.has(`${b.method} ${b.specPath}`)).map(
      (b) => `${b.method} ${b.specPath}`,
    );

    expect(stale, `manifest entries absent from the spec: ${stale.join(", ")}`).toEqual([]);
  });

  it("never lets two tools claim the same operation", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];

    for (const binding of OPERATION_BINDINGS) {
      const key = `${binding.method} ${binding.specPath}`;
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }

    expect(dupes).toEqual([]);
  });

  it("only calls endpoints the api actually serves", () => {
    const dead = OPERATION_BINDINGS.filter(
      (b) => !routes.has(`${b.method} ${b.path.replace(/:[^/]+/g, ":")}`),
    ).map((b) => `${b.tool} -> ${b.method} ${b.path}`);

    expect(dead, `tools pointing at unserved routes: ${dead.join(", ")}`).toEqual([]);
  });
});
