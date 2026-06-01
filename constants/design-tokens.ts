// constants/design-tokens.ts
export const colors = {
  primary: {
    50: "#f0f9ff",
    500: "#15A350",
    900: "#0f172a",
  },
  secondary: {
    500: "#3B82F6",
  },
  // ... other colors
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
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
  active: "bg-[#15A350]/10 text-[#15A350]",
  activeDark: "bg-[#15A350]/15 text-[#15A350]",
  inactive: "text-[#AAABAB] hover:bg-gray-100 hover:text-[#15A350]",
  inactiveDark: "text-[#AAABAB] hover:bg-white/5 hover:text-white",
} as const;
