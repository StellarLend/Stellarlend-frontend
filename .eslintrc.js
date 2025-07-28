// .eslintrc.js
module.exports = {
  rules: {
    "react/prop-types": "off", // Enforce TypeScript instead
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "component-props-naming": [
      "error",
      {
        rule: "^([A-Z][a-z]*)+Props$",
      },
    ],
    "component-file-structure": [
      "error",
      {
        requiredFiles: ["index.ts", "types.ts"],
      },
    ],
  },

  extends: ["plugin:storybook/recommended"]
};
