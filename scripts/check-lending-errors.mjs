import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(root, "lib", "errors", "lending-errors.snapshot.json");
const cataloguePath = path.join(root, "lib", "errors", "lending-errors.ts");

export function compareLendingErrors(snapshotErrors, catalogueErrors) {
  const failures = [];
  const snapshotCodes = new Map();
  const catalogueCodes = new Map();

  for (const { code, name } of snapshotErrors) {
    if (snapshotCodes.has(code)) failures.push(`Duplicate contract error code ${code} in snapshot.`);
    snapshotCodes.set(code, name);
  }
  for (const { code, name } of catalogueErrors) {
    if (catalogueCodes.has(code)) failures.push(`Duplicate frontend error code ${code} in catalogue.`);
    catalogueCodes.set(code, name);
  }

  for (const [code, name] of snapshotCodes) {
    if (!catalogueCodes.has(code)) failures.push(`Missing frontend entry for contract error ${code} (${name}).`);
    else if (catalogueCodes.get(code) !== name) {
      failures.push(`Name mismatch for error ${code}: contract has ${name}, frontend has ${catalogueCodes.get(code)}.`);
    }
  }
  for (const [code, name] of catalogueCodes) {
    if (!snapshotCodes.has(code)) failures.push(`Frontend error ${code} (${name}) is not present in the contract snapshot.`);
  }

  return failures;
}

function catalogueEntries(source) {
  return Array.from(source.matchAll(/^\s*(\d+):\s*\{\s*name:\s*"([^"]+)"/gm), (match) => ({
    code: Number(match[1]),
    name: match[2],
  }));
}

async function main() {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const source = await readFile(cataloguePath, "utf8");
  const failures = compareLendingErrors(snapshot.errors, catalogueEntries(source));
  if (failures.length) {
    console.error(`Lending error catalogue drift detected:\n- ${failures.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Lending error catalogue matches ${snapshot.errors.length} contract errors (${snapshot.revision}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
