import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "../..");
const schemaDir = path.join(rootDir, "lib/db/schema");
const docPath = path.join(rootDir, "docs/database-schema.md");

function listSchemaModules(): string[] {
  return readdirSync(schemaDir)
    .filter((entry) => entry.endsWith(".ts"))
    .filter((entry) => !entry.endsWith(".test.ts"))
    .sort();
}

describe("database schema documentation", () => {
  it("documents every schema module under lib/db/schema", () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readFileSync(docPath, "utf8");
    const missing = listSchemaModules().filter((entry) => {
      const modulePath = `lib/db/schema/${entry}`;
      return !doc.includes(modulePath);
    });

    expect(missing).toEqual([]);
  });

  it("links the schema guide from the README and backend architecture docs", () => {
    const readme = readFileSync(path.join(rootDir, "README.md"), "utf8");
    const backendArchitecture = readFileSync(
      path.join(rootDir, "docs/backend-architecture.md"),
      "utf8",
    );

    expect(readme).toContain("docs/database-schema.md");
    expect(backendArchitecture).toContain("./database-schema.md");
  });
});
