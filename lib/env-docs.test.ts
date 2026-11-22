import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigSchema, parseEnvFile, validateConfig } from "./config";

const root = resolve(__dirname, "..");
const envExamplePath = resolve(root, ".env.example");
const readmePath = resolve(root, "README.md");
const docsPagePath = resolve(root, "components/docs-page.tsx");
const sourceDirectories = [resolve(root, "lib"), resolve(root, "app")];
const middlewarePath = resolve(root, "middleware.ts");

// Add only source variables intentionally omitted from all environment docs.
const INTENTIONALLY_UNDOCUMENTED_ENV_VARS = new Set<string>();

function extractReadmeEnvKeys(readme: string): Set<string> {
  const heading = "## Environment variables";
  const headingIndex = readme.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error(`Could not find Environment variables section in ${readmePath}`);
  }
  const section = readme.slice(headingIndex + heading.length).split(/^## /m, 1)[0];
  return new Set([...section.matchAll(/\|\s*`(NEXT_PUBLIC_[A-Z0-9_]+)`\s*\|/g)].map((match) => match[1]));
}

function extractDocsPageEnvKeys(docsPage: string): Set<string> {
  const titleIndex = docsPage.indexOf('title={t("env.title")}');
  const sectionStart = docsPage.lastIndexOf("<Section", titleIndex);
  const sectionEnd = docsPage.indexOf("</Section>", titleIndex);
  if (titleIndex === -1 || sectionStart === -1 || sectionEnd === -1) {
    throw new Error(`Could not find environment variables list in ${docsPagePath}`);
  }
  const section = docsPage.slice(sectionStart, sectionEnd);
  return new Set([...section.matchAll(/"(NEXT_PUBLIC_[A-Z0-9_]+)"/g)].map((match) => match[1]));
}

function getSourcePublicEnvVars(): Set<string> {
  const envVars = new Set<string>();
  const addEnvVarsFromSource = (sourcePath: string) => {
    const source = readFileSync(sourcePath, "utf8");
    for (const match of source.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      envVars.add(match[1]);
    }
  };
  const visit = (sourcePath: string) => {
    const entries = readdirSync(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = resolve(sourcePath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
        addEnvVarsFromSource(entryPath);
      }
    }
  };

  for (const sourceDirectory of sourceDirectories) {
    visit(sourceDirectory);
  }
  addEnvVarsFromSource(middlewarePath);
  return envVars;
}

function expectKeysInFile(keys: Iterable<string>, documentedKeys: Set<string>, filePath: string): void {
  for (const key of keys) {
    if (!documentedKeys.has(key)) {
      throw new Error(`Missing ${key} in ${filePath}`);
    }
  }
}

describe("environment variable documentation", () => {
  const envContent = readFileSync(envExamplePath, "utf8");
  const exampleEnv = parseEnvFile(envContent);
  const schemaKeys = Object.keys(createConfigSchema(false).shape);
  const readmeEnvKeys = extractReadmeEnvKeys(readFileSync(readmePath, "utf8"));
  const docsPageEnvKeys = extractDocsPageEnvKeys(readFileSync(docsPagePath, "utf8"));

  it("documents every config schema key in .env.example, the README, and the docs page", () => {
    const envExampleKeys = new Set(Object.keys(exampleEnv));
    expectKeysInFile(schemaKeys, envExampleKeys, ".env.example");
    expectKeysInFile(schemaKeys, readmeEnvKeys, "README.md environment variables table");
    expectKeysInFile(schemaKeys, docsPageEnvKeys, "components/docs-page.tsx environment variables list");
  });

  it("documents every source NEXT_PUBLIC variable", () => {
    const sourceEnvVars = getSourcePublicEnvVars();
    const documentedSourceEnvVars = [...sourceEnvVars].filter(
      (key) => !INTENTIONALLY_UNDOCUMENTED_ENV_VARS.has(key)
    );
    const envExampleKeys = new Set(Object.keys(exampleEnv));

    expectKeysInFile(documentedSourceEnvVars, envExampleKeys, ".env.example");
    expectKeysInFile(documentedSourceEnvVars, readmeEnvKeys, "README.md environment variables table");
    expectKeysInFile(
      documentedSourceEnvVars,
      docsPageEnvKeys,
      "components/docs-page.tsx environment variables list"
    );
  });

  it("validates the values in .env.example", () => {
    expect(() => validateConfig(exampleEnv, { isDev: false })).not.toThrow();
  });
});
