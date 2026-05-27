import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

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
        test: {
          name: "unit",
          environment: "node",
          include: [
            "types/enums.test.ts",
            "app/api/transactions/route.test.ts",
            "app/api/webhooks/transactions/route.test.ts",
            "lib/webhooks/verify.test.ts",
          ],
          alias: {
            "@": path.resolve(dirname, "."),
          },
        },
      },
    ],
    coverage: {
      reporter: ["text", "json"],
      include: [
        "components/atoms/IconButton/IconButton.tsx",
        "components/shared/layout/TopNav.tsx",
        "types/enums.ts",
        "app/api/transactions/route.ts",
        "app/api/webhooks/transactions/route.ts",
        "lib/webhooks/verify.ts",
        "lib/webhooks/types.ts",
        "lib/transactions/store.ts",
      ],
    },
  },
});
