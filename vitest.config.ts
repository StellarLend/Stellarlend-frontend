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
        test: {
          name: "accessibility",
          include: [
            "components/atoms/IconButton/IconButton.test.tsx",
            "components/shared/layout/TopNav.test.tsx",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: [
            "app/api/**/*.test.ts",
            "lib/**/*.test.ts",
          ],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "lcov"],
            include: ["app/api/**/*.ts", "lib/**/*.ts"],
            exclude: ["**/*.test.ts", "**/*.d.ts", "lib/utils/**"],
            thresholds: {
              lines: 95,
              functions: 95,
              branches: 90,
              statements: 95,
            },
          },
        },
      },
    ],
    coverage: {
      reporter: ["text", "json"],
      include: [
        "components/atoms/IconButton/IconButton.tsx",
        "components/shared/layout/TopNav.tsx",
      ],
    },
  },
});
