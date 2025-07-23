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
