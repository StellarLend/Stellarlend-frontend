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
      include: ["lib/**/*.test.ts", "hooks/**/*.test.{ts,tsx}", "components/**/*.test.tsx"],
    },
  };
});
