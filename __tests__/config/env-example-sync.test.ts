import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "../..");
const scanTargets = [
  "app",
  "components",
  "config",
  "context",
  "lib",
  "src",
  "utils",
  "middleware.ts",
  "instrumentation.ts",
  "next.config.ts",
];

const ignoredEnv = new Set([
  "CI",
  "NODE_ENV",
  "NEXT_RUNTIME",
]);

const ignoredDirectories = new Set([
  "__tests__",
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "dist",
  "build",
]);

function walkFiles(target: string): string[] {
  const absolute = path.join(rootDir, target);
  if (!existsSync(absolute)) {
    return [];
  }

  const stats = statSync(absolute);
  if (stats.isFile()) {
    return /\.[cm]?[tj]sx?$/.test(absolute) ? [absolute] : [];
  }

  return readdirSync(absolute).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) {
      return [];
    }

    return walkFiles(path.join(target, entry));
  });
}

function collectEnvReads(source: string): string[] {
  const variables = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const variable = match[1];
      if (!ignoredEnv.has(variable)) {
        variables.add(variable);
      }
    }
  }

  return [...variables];
}

function collectExampleKeys(): Set<string> {
  const example = readFileSync(path.join(rootDir, ".env.example"), "utf8");
  return new Set(
    example
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0]?.trim())
      .filter(Boolean),
  );
}

describe(".env.example sync", () => {
  it("documents app-specific process.env reads", () => {
    const used = new Set<string>();

    for (const file of scanTargets.flatMap(walkFiles)) {
      for (const variable of collectEnvReads(readFileSync(file, "utf8"))) {
        used.add(variable);
      }
    }

    const documented = collectExampleKeys();
    const missing = [...used].filter((variable) => !documented.has(variable)).sort();

    expect(missing).toEqual([]);
  });

  it("keeps server-only secrets out of NEXT_PUBLIC names", () => {
    const documented = collectExampleKeys();
    const serverOnlySecrets = [
      "AUTH_SECRET",
      "AUTH_SIGNING_SECRET",
      "JWT_SECRET",
      "PRICE_ORACLE_API_KEY",
      "SERVER_TOKEN",
      "STELLAR_SIGNING_SECRET",
      "WEBHOOK_SECRET",
    ];

    for (const secret of serverOnlySecrets) {
      expect(documented.has(secret)).toBe(true);
      expect(documented.has("NEXT_PUBLIC_" + secret)).toBe(false);
    }
  });
});
