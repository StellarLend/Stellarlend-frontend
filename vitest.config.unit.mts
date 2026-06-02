// @ts-nocheck - vitest config requires types that aren't currently installed
// @ts-ignore - node:path types not available without @types/node
import path from "node:path";
// @ts-ignore - node:url types not available without @types/node
import { fileURLToPath } from "node:url";
// @ts-ignore - vitest/config types not available
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/config.test.ts",
    ],
    alias: {
      "@": path.resolve(dirname, "."),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/config.ts",
        "lib/configValidation.ts",
      ],
    },
  },
});
