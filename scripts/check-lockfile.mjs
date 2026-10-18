import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkLockfile(filePath) {
  const lockfile = JSON.parse(readFileSync(filePath, "utf8"));
  if (!lockfile.packages || typeof lockfile.packages !== "object") {
    throw new Error("Lockfile is missing its packages map");
  }

  for (const [name, metadata] of Object.entries(lockfile.packages)) {
    if (typeof metadata.resolved !== "string") {
      continue;
    }

    let url;
    try {
      url = new URL(metadata.resolved);
    } catch {
      throw new Error(`Invalid resolved URL for ${name}: ${metadata.resolved}`);
    }

    if (url.origin !== "https://registry.npmjs.org") {
      throw new Error(`Unexpected registry for ${name}: ${metadata.resolved}`);
    }
    if (typeof metadata.integrity !== "string" || metadata.integrity.trim() === "") {
      throw new Error(`Missing integrity hash for ${name}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkLockfile(process.argv[2] ?? resolve(process.cwd(), "package-lock.json"));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
