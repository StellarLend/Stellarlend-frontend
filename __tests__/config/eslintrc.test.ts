import { describe, expect, it } from "vitest";
import eslintConfig from "../../.eslintrc.js";

describe(".eslintrc.js", () => {
  it("exports a valid ESLint configuration object", () => {
    expect(eslintConfig).toBeDefined();
    expect(typeof eslintConfig).toBe("object");
    expect(eslintConfig).not.toBeNull();
  });

  it("extends expected configurations", () => {
    expect(Array.isArray(eslintConfig.extends)).toBe(true);
    expect(eslintConfig.extends).toContain("next/core-web-vitals");
  });

  it("disables specific rules for the project", () => {
    expect(eslintConfig.rules).toBeDefined();
    expect(eslintConfig.rules["react/prop-types"]).toBe("off");
    expect(eslintConfig.rules["@next/next/no-html-link-for-pages"]).toBe("off");
    expect(eslintConfig.rules["react/no-unescaped-entities"]).toBe("off");
    expect(eslintConfig.rules["react-hooks/exhaustive-deps"]).toBe("off");
    expect(eslintConfig.rules["@next/next/no-img-element"]).toBe("off");
    expect(eslintConfig.rules["@typescript-eslint/no-var-requires"]).toBe("off");
  });

  it("enforces RPC endpoint protection via no-restricted-syntax", () => {
    const noRestrictedSyntax = eslintConfig.rules["no-restricted-syntax"];
    expect(noRestrictedSyntax).toBeDefined();
    expect(Array.isArray(noRestrictedSyntax)).toBe(true);
    
    // Ensure the rule is set to "error"
    expect(noRestrictedSyntax[0]).toBe("error");

    // Ensure it contains selectors guarding against NEXT_PUBLIC_.*RPC.*
    const rules = noRestrictedSyntax.slice(1);
    expect(rules.length).toBeGreaterThan(0);
    
    rules.forEach((rule: any) => {
      expect(rule).toHaveProperty("selector");
      expect(rule).toHaveProperty("message");
      expect(rule.message).toContain("Do not expose RPC endpoints via NEXT_PUBLIC_* env vars");
      expect(rule.selector).toContain("NEXT_PUBLIC_.*RPC.*$");
    });
  });

  it("handles deterministic behavior without side effects", () => {
    // Repeated imports or reads should yield the same configuration structure
    // This addresses the "retries/partial failure" invariant checks for a static config.
    const reImport = require("../../.eslintrc.js");
    expect(reImport).toEqual(eslintConfig);
  });
});
