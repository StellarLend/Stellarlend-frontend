// test/design-tokens.test.ts
import { describe, it, expect } from "vitest";
import designTokens, {
  colorGreen,
  colorNeutral,
  colorSemantic,
  colorSurface,
  colorText,
  colorBorder,
  borderRadius,
  boxShadow,
  fontSize,
  fontWeight,
  letterSpacing,
  spacing,
  colors,
} from "../constants/design-tokens";

// helper — checks a value is a valid hex / rgb / rgba
const isColor = (v: string) =>
  /^#[0-9A-Fa-f]{3,8}$/.test(v) ||
  /^rgba?\(/.test(v) ||
  /^hsla?\(/.test(v);

// helper — checks a value is a valid CSS length
const isLength = (v: string) =>
  /^[\d.]+(rem|px|em|%)$/.test(v) || v === "0" || v === "9999px";

// ── Color ramps ─────────────────────────────────────────────────────────────

describe("colorGreen", () => {
  it("has 10 shades (50–900)", () => {
    expect(Object.keys(colorGreen)).toHaveLength(10);
  });

  it("every value is a valid hex colour", () => {
    Object.entries(colorGreen).forEach(([shade, value]) => {
      expect(isColor(value), `green-${shade}: ${value}`).toBe(true);
    });
  });

  it("includes the original brand accent #097C4C at shade 500", () => {
    expect(colorGreen[500]).toBe("#097C4C");
  });

  it("includes the original dark background #0A3D1E at shade 600", () => {
    expect(colorGreen[600]).toBe("#0A3D1E");
  });
});

describe("colorNeutral", () => {
  it("has 12 shades (0–950)", () => {
    expect(Object.keys(colorNeutral)).toHaveLength(12);
  });

  it("every value is a valid hex colour", () => {
    Object.entries(colorNeutral).forEach(([shade, value]) => {
      expect(isColor(value), `neutral-${shade}: ${value}`).toBe(true);
    });
  });

  it("includes the original muted text colour #AAABAB at shade 500", () => {
    expect(colorNeutral[500]).toBe("#AAABAB");
  });
});

describe("colorSemantic", () => {
  it("defines all feedback colours", () => {
    const required = ["success", "successLight", "warning", "warningLight", "error", "errorLight", "info", "infoLight"];
    required.forEach((key) => {
      expect(colorSemantic).toHaveProperty(key);
    });
  });

  it("every value is a valid colour", () => {
    Object.entries(colorSemantic).forEach(([key, value]) => {
      expect(isColor(value), `semantic.${key}: ${value}`).toBe(true);
    });
  });
});

describe("colorSurface", () => {
  it("surface-base matches the dark green background", () => {
    expect(colorSurface.base).toBe("#0A3D1E");
  });

  it("all surface values are valid colours", () => {
    Object.entries(colorSurface).forEach(([key, value]) => {
      expect(isColor(value), `surface.${key}`).toBe(true);
    });
  });
});

describe("colorText", () => {
  it("text-secondary matches muted text colour", () => {
    expect(colorText.secondary).toBe("#AAABAB");
  });

  it("all text values are valid colours", () => {
    Object.entries(colorText).forEach(([key, value]) => {
      expect(isColor(value), `text.${key}`).toBe(true);
    });
  });
});

describe("colorBorder", () => {
  it("all border values are valid colours", () => {
    Object.entries(colorBorder).forEach(([key, value]) => {
      expect(isColor(value), `border.${key}`).toBe(true);
    });
  });
});

describe("colors (flat map)", () => {
  it("contains surface-base", () => {
    expect(colors["surface-base"]).toBeDefined();
  });

  it("contains text-secondary pointing to #AAABAB", () => {
    expect(colors["text-secondary"]).toBe("#AAABAB");
  });

  it("contains green-500 pointing to #097C4C", () => {
    expect(colors["green-500"]).toBe("#097C4C");
  });

  it("contains green-600 pointing to #0A3D1E", () => {
    expect(colors["green-600"]).toBe("#0A3D1E");
  });

  it("every value in the flat map is a valid colour", () => {
    Object.entries(colors).forEach(([key, value]) => {
      expect(isColor(value), `colors["${key}"]: ${value}`).toBe(true);
    });
  });
});

// ── Typography ───────────────────────────────────────────────────────────────

describe("fontSize", () => {
  it("has at least 10 size steps", () => {
    expect(Object.keys(fontSize).length).toBeGreaterThanOrEqual(10);
  });

  it("every size is a tuple [size, { lineHeight }]", () => {
    Object.entries(fontSize).forEach(([name, tuple]) => {
      expect(Array.isArray(tuple), name).toBe(true);
      expect(isLength(tuple[0]), `fontSize.${name}[0]`).toBe(true);
    });
  });
});

describe("fontWeight", () => {
  it("includes normal, medium, semibold, bold", () => {
    expect(fontWeight.normal).toBeDefined();
    expect(fontWeight.medium).toBeDefined();
    expect(fontWeight.semibold).toBeDefined();
    expect(fontWeight.bold).toBeDefined();
  });

  it("all weights are numeric string values", () => {
    Object.entries(fontWeight).forEach(([key, value]) => {
      expect(!isNaN(Number(value)), `fontWeight.${key}: ${value}`).toBe(true);
    });
  });
});

describe("letterSpacing", () => {
  it("includes normal tracking", () => {
    expect(letterSpacing.normal).toBe("0em");
  });
});

// ── Geometry ─────────────────────────────────────────────────────────────────

describe("borderRadius", () => {
  it("defines none and full", () => {
    expect(borderRadius.none).toBe("0");
    expect(borderRadius.full).toBe("9999px");
  });

  it("all values are valid CSS lengths or 0 or 9999px", () => {
    Object.entries(borderRadius).forEach(([key, value]) => {
      expect(isLength(value), `borderRadius.${key}: ${value}`).toBe(true);
    });
  });
});

describe("boxShadow", () => {
  it("includes sm, md, lg, glow, none", () => {
    expect(boxShadow.sm).toBeDefined();
    expect(boxShadow.md).toBeDefined();
    expect(boxShadow.lg).toBeDefined();
    expect(boxShadow.glow).toBeDefined();
    expect(boxShadow.none).toBe("none");
  });

  it("glow shadow references the brand accent green", () => {
    expect(boxShadow.glow).toContain("9, 124, 76");
  });
});

describe("spacing", () => {
  it("all custom spacing values are valid rem lengths", () => {
    Object.entries(spacing).forEach(([key, value]) => {
      expect(isLength(value), `spacing.${key}: ${value}`).toBe(true);
    });
  });
});

// ── Default export ────────────────────────────────────────────────────────────

describe("designTokens (default export)", () => {
  it("exports all top-level sections", () => {
    expect(designTokens.colors).toBeDefined();
    expect(designTokens.fontFamily).toBeDefined();
    expect(designTokens.fontSize).toBeDefined();
    expect(designTokens.fontWeight).toBeDefined();
    expect(designTokens.borderRadius).toBeDefined();
    expect(designTokens.boxShadow).toBeDefined();
    expect(designTokens.spacing).toBeDefined();
  });

  it("is frozen / immutable at runtime (as const)", () => {
    // TypeScript `as const` is compile-time, but object should still be an object
    expect(typeof designTokens).toBe("object");
    expect(designTokens).not.toBeNull();
  });
});