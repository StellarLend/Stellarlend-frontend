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
    env: {
      NEXT_PUBLIC_APP_NAME: 'Stellarlend',
      NEXT_PUBLIC_APP_VERSION: '1.0.0',
      NEXT_PUBLIC_APP_ENV: 'development',
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
      NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
      NEXT_PUBLIC_STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      API_RATE_LIMIT_MAX: '100',
      API_RATE_LIMIT_WINDOW_MS: '60000',
      TX_ACCOUNT_RATE_LIMIT_MAX: '30',
      TX_ACCOUNT_RATE_LIMIT_WINDOW_MS: '60000',
      TX_ACCOUNT_RATE_LIMIT_BURST: '60',
    },

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
            "app/lending/**/*.test.tsx",
            "app/account/**/*.test.tsx",
            "components/atoms/IconButton/IconButton.test.tsx",
            "components/atoms/Button/Button.test.tsx",
            "components/shared/layout/TopNav.test.tsx",
            "components/shared/layout/**/*.test.tsx",
            "components/shared/common/**/*.test.tsx",
            "components/shared/ui/**/*.test.tsx",
            "components/features/dashboard/**/*.test.tsx",
            "components/features/account/**/*.test.tsx",
            "lib/utils/clipboard.test.ts",
            "lib/search/**/*.test.ts",
            "components/features/lending/**/*.test.tsx",
            "context/**/*.test.{ts,tsx}",
            "hooks/**/*.test.{ts,tsx}",
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
            "app/api/markets/route.test.ts",
            "app/api/transactions/route.test.ts",
            "app/api/liquidations/route.test.ts",
            "app/api/notifications/[id]/route.test.ts",
            "app/api/auth/logout/route.test.ts",
            "app/api/stream/prices/route.test.ts",
            "__tests__/**/*.test.ts",
            "docs/__tests__/**/*.test.ts",
            "lib/streams/**/*.test.ts",
            "lib/security/**/*.test.ts",
            "lib/utils/**/*.test.ts",
          ],
            include: [
                "types/enums.test.ts",
                "app/api/markets/route.test.ts",
                "app/api/transactions/route.test.ts",
                "app/api/liquidations/route.test.ts",
                "app/api/notifications/[id]/route.test.ts",
                "__tests__/**/*.test.ts",
                "lib/**/*.test.ts",
            ],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          globals: true,
          setupFiles: "./vitest.setup.ts",
          include: [
            "test/server/**/*.test.ts",
            "app/api/**/*.test.ts",
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
        "app/api/**",
        "lib/**",
        "hooks/usePriceStream.ts",
        "components/atoms/IconButton/IconButton.tsx",
        "components/shared/ui/AmountInput.tsx",
        "components/shared/layout/TopNav.tsx",
        "components/shared/layout/NavLink.tsx",
        "components/shared/layout/NavigationMenu.tsx",
        "components/shared/layout/Navbar.tsx",
        "components/shared/layout/SideNav.tsx",
        "components/shared/common/PriceTicker.tsx",
        "constants/design-tokens.ts",
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