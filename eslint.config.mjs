import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // New in eslint-plugin-react-hooks 7 (eslint-config-next 16); existing
      // load-from-storage / fetch-on-mount effects trip it, so report only.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**"],
  },
];

export default config;
