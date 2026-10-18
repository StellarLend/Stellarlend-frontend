#!/usr/bin/env node
/**
 * scripts/check-lockfile.mjs
 *
 * Verifies that every package in package-lock.json resolves from
 * https://registry.npmjs.org/ — no private registries, no git URLs,
 * no localhost, no http:// downloads.
 *
 * Usage:
 *   node scripts/check-lockfile.mjs               # checks package-lock.json
 *   node scripts/check-lockfile.mjs <path>         # checks a specific lockfile
 *
 * Exit 0 = all resolved URLs are clean.
 * Exit 1 = one or more bad URLs found (prints them).
 *
 * Tested with Node.js 20 built-in modules only — zero external dependencies.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_REGISTRY = "https://registry.npmjs.org/";

const lockfilePath = process.argv[2] ?? resolve(process.cwd(), "package-lock.json");

let lockfile;
try {
  lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
} catch (err) {
  console.error(`check-lockfile: cannot read ${lockfilePath}: ${err.message}`);
  process.exit(1);
}

const violations = [];

// package-lock.json v2/v3 uses the "packages" map.
const packages = lockfile.packages ?? {};
for (const [name, meta] of Object.entries(packages)) {
  if (!meta.resolved) continue; // workspace packages have no resolved URL

  const url = meta.resolved;

  // Must start with the official registry
  if (!url.startsWith(ALLOWED_REGISTRY)) {
    violations.push({ name: name || "(root)", url });
  }

  // Must have an integrity hash
  if (!meta.integrity) {
    violations.push({ name: name || "(root)", url, issue: "missing integrity hash" });
  }
}

if (violations.length === 0) {
  console.log(`check-lockfile: OK — all ${Object.keys(packages).length} packages resolve from ${ALLOWED_REGISTRY}`);
  process.exit(0);
} else {
  console.error(`check-lockfile: FAIL — ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.name}`);
    console.error(`    resolved: ${v.url}`);
    if (v.issue) console.error(`    issue: ${v.issue}`);
  }
  process.exit(1);
}
