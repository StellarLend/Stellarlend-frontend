import path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [tsconfigPaths(), react()],

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
        test: {
          name: "accessibility",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./vitest.setup.ts"],
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
          ],

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
      ],
    },
  },
});
