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
      environment: "node",
      globals: true,
      testTimeout: 60000,
      include: ["integration/**/*.test.ts"],
    },
  };
});
