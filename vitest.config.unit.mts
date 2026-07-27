import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/config.test.ts",
      "lib/validation/**/*.test.ts",
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
