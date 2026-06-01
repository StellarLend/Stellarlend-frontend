import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
    typeof __dirname !== "undefined"
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
    },
  },

  test: {
    globals: true,

    projects: [
      {
        extends: true,

        plugins: [
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
          name: "accessibility",
          environment: "jsdom",
          setupFiles: "./vitest.setup.ts",

          include: [
            "components/atoms/IconButton/IconButton.test.tsx",
            "components/shared/layout/TopNav.test.tsx",
          ],
        },
      },

      {
        extends: true,

        test: {
          name: "server-unit",
          environment: "node",

          include: [
            "types/enums.test.ts",
            "app/api/transactions/route.test.ts",
          ],
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
      reporter: ["text", "json"],

      include: [
        "app/api/**",
        "lib/**",
        "components/atoms/IconButton/IconButton.tsx",
        "components/shared/layout/TopNav.tsx",
        "types/enums.ts",
        "app/api/transactions/route.ts",
        "app/api/webhooks/transactions/route.ts",
        "lib/webhooks/verify.ts",
        "lib/webhooks/types.ts",
        "lib/transactions/store.ts",
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