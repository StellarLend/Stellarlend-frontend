// Button.types.ts
import type { ReactNode } from "react";

/**
 * Button variants. The default is "primary".
 */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Button sizes. The default is "md".
 */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Class name input. Accepts a single string or an array of class name
 * strings. Nested arrays and nullish entries are not supported and will be
 * rejected at the type level to keep class merging deterministic.
 */
export type ButtonClassName = string | string[];

export interface ButtonProps {
  /** Visual variant. Defaults to "primary". */
  variant?: ButtonVariant;
  /** Control size. Defaults to "md". */
  size?: ButtonSize;
  /** Button label content. Required for accessible labeling. */
  children: ReactNode;
  /** Click handler. Not invoked when the button is disabled or loading. */
  onClick?: () => void;
  /** When true, the button is non-interactive and shows a loading state. */
  isLoading?: boolean;
  /** When true, the button is non-interactive. */
  disabled?: boolean;
  /** Additional class names merged onto the root element. */
  className?: ButtonClassName;
}
