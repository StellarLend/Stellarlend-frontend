// .eslintrc.js
module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    "react/prop-types": "off",
    "@next/next/no-html-link-for-pages": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/exhaustive-deps": "off",
    "@next/next/no-img-element": "off",
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "MemberExpression[object.object.name='process'][object.property.name='env'][computed=false][property.name=/^NEXT_PUBLIC_.*RPC.*$/]",
        message:
          "Do not expose RPC endpoints via NEXT_PUBLIC_* env vars. Move them to lib/server-config.ts.",
      },
      {
        selector:
          "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value=/^NEXT_PUBLIC_.*RPC.*$/]",
        message:
          "Do not expose RPC endpoints via NEXT_PUBLIC_* env vars. Move them to lib/server-config.ts.",
      },
      {
        selector:
          "VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.name=/^NEXT_PUBLIC_.*RPC.*$/]",
        message:
          "Do not expose RPC endpoints via NEXT_PUBLIC_* env vars. Move them to lib/server-config.ts.",
      },
      {
        selector:
          "VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.value=/^NEXT_PUBLIC_.*RPC.*$/]",
        message:
          "Do not expose RPC endpoints via NEXT_PUBLIC_* env vars. Move them to lib/server-config.ts.",
      },
    ],
    "@typescript-eslint/no-var-requires": "off",
  },
};
