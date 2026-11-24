import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const { default: react } = await import("@vitejs/plugin-react");
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["lib/**/*.test.ts", "hooks/**/*.test.{ts,tsx}", "components/**/*.test.tsx", "middleware.test.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        reportsDirectory: "./coverage",
        include: ["lib/**", "hooks/**", "components/**"],
        exclude: [
          "**/*.test.{ts,tsx}",
          "**/*.d.ts",
          "**/tests/fixtures/**",
        ],
        // Thresholds set ~4 points below the measured baseline (see PR description).
        // lib/** is held to a higher bar than components/**.
        thresholds: {
          statements: 60,
          branches: 51,
          functions: 58,
          lines: 60,
          "lib/**": {
            statements: 62,
            branches: 54,
            functions: 62,
            lines: 62,
          },
          "components/**": {
            statements: 57,
            branches: 45,
            functions: 52,
            lines: 57,
          },
        },
      },
    },
  };
});
