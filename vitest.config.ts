import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const alias = { "@": path.resolve(dirname, ".") };

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "lib/**/*.test.ts",
            "app/api/**/*.test.ts",
            "components/**/*.test.tsx",
          ],
        },
      },
      {
        test: {
          name: "accessibility",
          include: [
            "components/atoms/IconButton/IconButton.test.tsx",
            "components/shared/layout/TopNav.test.tsx",
          ],
        },
      },
      {
        test: {
          name: "unit",
          environment: "node",
          include: [
            "types/enums.test.ts",
            "app/api/transactions/route.test.ts",
            "lib/config.test.ts",
          ],
          alias: {
            "@": path.resolve(dirname, "."),
          },
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["test/server/**/*.test.ts"],
          alias: {
            "@": path.resolve(dirname, "."),
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      include: [
        "app/api/**",
        "lib/**",
        "components/atoms/IconButton/IconButton.tsx",
        "components/shared/layout/TopNav.tsx",
        "types/enums.ts",
        "app/api/transactions/route.ts",
        "lib/config.ts",
        "lib/server-config.ts",
      ],
      exclude: ["lib/utils/cn.ts", "**/*.stories.*", "**/*.test.*"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
