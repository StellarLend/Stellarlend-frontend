// constants/design-tokens.ts
// ──────────────────────────────────────────────────────────────────────────────
// Single source of truth for the StellarLend design system.
// These values are consumed by:
//   • Tailwind v4 theme (via CSS @theme in app/globals.css)
//   • TypeScript components (import tokens directly for logic/tests)
//   • Storybook Foundations story
// ──────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------

/** Primary green ramp — brand identity */
export const colorGreen = {
  50:  "#E6F5EE",
  100: "#C2E5D3",
  200: "#9DD5B7",
  300: "#78C49B",
  400: "#53B47F",
  500: "#097C4C", // base accent (was the only colour before)
  600: "#0A3D1E", // dark background panels
  700: "#082F17",
  800: "#062110",
  900: "#031309",
} as const;

/** Neutral greys — text, borders, backgrounds */
export const colorNeutral = {
  0:   "#FFFFFF",
  50:  "#F8F9FA",
  100: "#F1F3F5",
  200: "#E9ECEF",
  300: "#DEE2E6",
  400: "#CED4DA",
  500: "#AAABAB", // muted text (was hardcoded in MetricsCards)
  600: "#868E96",
  700: "#495057",
  800: "#343A40",
  900: "#212529",
  950: "#0D0F10",
} as const;

/** Semantic / feedback colours */
export const colorSemantic = {
  success:        "#097C4C",
  successLight:   "#E6F5EE",
  warning:        "#F59F00",
  warningLight:   "#FFF9DB",
  error:          "#E03131",
  errorLight:     "#FFF5F5",
  info:           "#1971C2",
  infoLight:      "#E7F5FF",
} as const;

/** Surface / background tokens */
export const colorSurface = {
  base:           "#0A3D1E", // deep green — primary background
  elevated:       "#0D4F27", // cards / panels slightly lighter
  overlay:        "#0F6130", // modals, popovers
  muted:          "#062110", // recessed areas
  inverse:        "#FFFFFF",
} as const;

/** Text tokens */
export const colorText = {
  primary:        "#FFFFFF",
  secondary:      "#AAABAB", // muted labels (was hardcoded)
  disabled:       "#868E96",
  inverse:        "#0A3D1E",
  accent:         "#097C4C",
} as const;

/** Border tokens */
export const colorBorder = {
  default:        "#0F6130",
  muted:          "#082F17",
  accent:         "#097C4C",
  inverse:        "#DEE2E6",
} as const;

// Flatten everything the Tailwind theme needs into one map
export const colors = {
  "green-50":  colorGreen[50],
  "green-100": colorGreen[100],
  "green-200": colorGreen[200],
  "green-300": colorGreen[300],
  "green-400": colorGreen[400],
  "green-500": colorGreen[500],
  "green-600": colorGreen[600],
  "green-700": colorGreen[700],
  "green-800": colorGreen[800],
  "green-900": colorGreen[900],

  "neutral-0":   colorNeutral[0],
  "neutral-50":  colorNeutral[50],
  "neutral-100": colorNeutral[100],
  "neutral-200": colorNeutral[200],
  "neutral-300": colorNeutral[300],
  "neutral-400": colorNeutral[400],
  "neutral-500": colorNeutral[500],
  "neutral-600": colorNeutral[600],
  "neutral-700": colorNeutral[700],
  "neutral-800": colorNeutral[800],
  "neutral-900": colorNeutral[900],
  "neutral-950": colorNeutral[950],

  "surface-base":     colorSurface.base,
  "surface-elevated": colorSurface.elevated,
  "surface-overlay":  colorSurface.overlay,
  "surface-muted":    colorSurface.muted,
  "surface-inverse":  colorSurface.inverse,

  "text-primary":   colorText.primary,
  "text-secondary": colorText.secondary,
  "text-disabled":  colorText.disabled,
  "text-inverse":   colorText.inverse,
  "text-accent":    colorText.accent,

  "border-default": colorBorder.default,
  "border-muted":   colorBorder.muted,
  "border-accent":  colorBorder.accent,
  "border-inverse": colorBorder.inverse,

  "success":        colorSemantic.success,
  "success-light":  colorSemantic.successLight,
  "warning":        colorSemantic.warning,
  "warning-light":  colorSemantic.warningLight,
  "error":          colorSemantic.error,
  "error-light":    colorSemantic.errorLight,
  "info":           colorSemantic.info,
  "info-light":     colorSemantic.infoLight,
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans:  "var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif)",
  mono:  "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
  display: "var(--font-display, 'Inter', ui-sans-serif, sans-serif)",
} as const;

export const fontSize = {
  "2xs": ["0.625rem",  { lineHeight: "0.875rem" }],   // 10px
  xs:    ["0.75rem",   { lineHeight: "1rem" }],        // 12px
  sm:    ["0.875rem",  { lineHeight: "1.25rem" }],     // 14px
  base:  ["1rem",      { lineHeight: "1.5rem" }],      // 16px
  lg:    ["1.125rem",  { lineHeight: "1.75rem" }],     // 18px
  xl:    ["1.25rem",   { lineHeight: "1.75rem" }],     // 20px
  "2xl": ["1.5rem",    { lineHeight: "2rem" }],        // 24px
  "3xl": ["1.875rem",  { lineHeight: "2.25rem" }],     // 30px
  "4xl": ["2.25rem",   { lineHeight: "2.5rem" }],      // 36px
  "5xl": ["3rem",      { lineHeight: "1" }],           // 48px
  "6xl": ["3.75rem",   { lineHeight: "1" }],           // 60px
} as const;

export const fontWeight = {
  light:    "300",
  normal:   "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
  extrabold:"800",
} as const;

export const letterSpacing = {
  tighter: "-0.05em",
  tight:   "-0.025em",
  normal:  "0em",
  wide:    "0.025em",
  wider:   "0.05em",
  widest:  "0.1em",
} as const;

// ---------------------------------------------------------------------------
// BORDER RADIUS
// ---------------------------------------------------------------------------

export const borderRadius = {
  none:  "0",
  sm:    "0.125rem",   // 2px
  base:  "0.25rem",    // 4px
  md:    "0.375rem",   // 6px
  lg:    "0.5rem",     // 8px
  xl:    "0.75rem",    // 12px
  "2xl": "1rem",       // 16px
  "3xl": "1.5rem",     // 24px
  full:  "9999px",
} as const;

// ---------------------------------------------------------------------------
// SHADOWS
// ---------------------------------------------------------------------------

export const boxShadow = {
  sm:    "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
  base:  "0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)",
  md:    "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)",
  lg:    "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
  xl:    "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
  glow:  "0 0 20px rgba(9, 124, 76, 0.4)",
  none:  "none",
} as const;

// ---------------------------------------------------------------------------
// SPACING (extends Tailwind defaults — only custom values needed)
// ---------------------------------------------------------------------------

export const spacing = {
  "4.5": "1.125rem",   // 18px — common gap between form fields
  "13":  "3.25rem",    // 52px
  "15":  "3.75rem",    // 60px
  "18":  "4.5rem",     // 72px
  "22":  "5.5rem",     // 88px
} as const;

// ---------------------------------------------------------------------------
// CONVENIENCE: flat token export for Storybook / tests
// ---------------------------------------------------------------------------

const designTokens = {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  borderRadius,
  boxShadow,
  spacing,
} as const;

/**
 * Nav state tokens — single source of truth for focus-visible ring,
 * active background/text, inactive text, and minimum touch target.
 *
 * Usage (Tailwind):
 *   focus-visible:ring-2 focus-visible:ring-[--nav-focus-ring] focus-visible:ring-offset-2
 *   active → bg-[--nav-active-bg] text-[--nav-active-text]
 *   inactive → text-[--nav-inactive-text]
 */
export const navTokens = {
  /** Focus-visible ring colour (matches brand primary) */
  focusRing: "#15A350",
  /** Active link background (10 % primary tint for light, 15 % for dark) */
  activeBgLight: "#15A350/10",
  activeBgDark: "#15A350/15",
  /** Active link text */
  activeText: "#15A350",
  /** Inactive / default link text */
  inactiveText: "#AAABAB",
  /** Active indicator bar colour */
  indicatorBar: "#15A350",
  /** Minimum touch-target height (WCAG 2.5.5 recommended 44 px) */
  minTouchTarget: "2.75rem", // 44px
} as const;

/**
 * Tailwind class strings derived from navTokens.
 * Import these instead of repeating raw colour values in components.
 */
export const navClasses = {
  /** Applied to every nav link element */
  base: "group flex items-center gap-2 px-4 rounded-lg font-medium transition-all duration-200 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2",
  /** Minimum touch target — py value that gives ≥ 44 px height */
  touchTarget: "py-3.5",
  /** Focus-visible ring for icon-only controls (IconButton, collapse toggle, etc.) */
  iconButtonFocusClasses: "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2",
  active: "bg-[#15A350]/10 text-[#15A350]",
  activeDark: "bg-[#15A350]/15 text-[#15A350]",
  inactive: "text-[#AAABAB] hover:bg-gray-100 hover:text-[#15A350]",
  inactiveDark: "text-[#AAABAB] hover:bg-white/5 hover:text-white",
} as const;
