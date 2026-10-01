// Button.types.ts
/**
 * Props for the Button component.
 *
 * - `variant` determines the visual style. Defaults are applied in the component.
 * - `size` controls padding and typography size.
 * - `children` is the button label/content.
 * - `onClick` is the click handler.
 * - `isLoading` disables the button and shows a spinner.
 * - `className` allows custom CSS classes; it must be a non‑empty string.
 *
 * The interface is deliberately permissive (all fields optional except `children`)
 * because the component provides runtime defaults. Validation is performed by
 * `validateButtonProps` to guarantee deterministic failure paths.
 */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
  /** Optional additional CSS classes. Must be a string if supplied. */
  className?: string;
}

/**
 * Runtime validation for {@link ButtonProps}. Throws an {@link Error} with a clear
 * message when any invariant is violated. This function is used by the Button
 * component to enforce deterministic failure behaviour.
 *
 * @param props Partial props object to validate.
 * @throws Error if validation fails.
 */
export function validateButtonProps(props: Partial<ButtonProps>): void {
  const { variant, size, className, onClick, isLoading, children } = props;

  // variant must be one of the allowed literals if present
  const allowedVariants = ["primary", "secondary", "ghost"] as const;
  if (variant !== undefined && !allowedVariants.includes(variant as any)) {
    throw new Error(`Button: invalid variant "${variant}". Allowed values: ${allowedVariants.join(", ")}`);
  }

  // size must be one of the allowed literals if present
  const allowedSizes = ["sm", "md", "lg"] as const;
  if (size !== undefined && !allowedSizes.includes(size as any)) {
    throw new Error(`Button: invalid size "${size}". Allowed values: ${allowedSizes.join(", ")}`);
  }

  // className, if provided, must be a non‑empty string and not exceed 256 chars
  if (className !== undefined) {
    if (typeof className !== "string") {
      throw new Error(`Button: className must be a string`);
    }
    if (className.length === 0) {
      throw new Error(`Button: className cannot be an empty string`);
    }
    if (className.length > 256) {
      throw new Error(`Button: className exceeds maximum length of 256 characters`);
    }
  }

  // onClick, if provided, must be a function
  if (onClick !== undefined && typeof onClick !== "function") {
    throw new Error(`Button: onClick must be a function`);
  }

  // isLoading, if provided, must be boolean
  if (isLoading !== undefined && typeof isLoading !== "boolean") {
    throw new Error(`Button: isLoading must be a boolean`);
  }

  // children must be defined (ReactNode) – we only check for null/undefined
  if (children === null || children === undefined) {
    throw new Error(`Button: children must be provided`);
  }
}


