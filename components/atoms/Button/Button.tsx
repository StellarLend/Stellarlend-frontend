import React, { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { validateButtonProps } from './Button.types';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'danger'
  | 'success'
  | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  text?: string;
}

/**
 * Invariants:
 * - The button is always non-submitting unless the caller explicitly passes `type="submit"`.
 * - When `isLoading` is true, the button is disabled and cannot be activated by click or keyboard.
 * - Unknown variant/size values fall back to defaults rather than throwing.
 * - Only one accessible name is exposed: children take precedence over `text`.
 */

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#15A350] text-white hover:bg-[#128F42] shadow-sm border border-transparent',
  secondary:
    'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 border border-transparent',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 shadow-sm border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 shadow-sm border border-transparent',
  success:
    'bg-green-600 text-white hover:bg-green-700 shadow-sm border border-transparent',
  outline:
    'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      text,
      disabled,
      type,
      ...props
    },
    ref
  ) => {
    // Coerce legacy array className to string for compatibility
    const normalizedClassName = Array.isArray(className) ? className.join(' ') : className;

    // Validate props deterministically
    validateButtonProps({
      variant,
      size,
      className: normalizedClassName,
      onClick: props.onClick,
      isLoading,
      children: children ?? text,
    });

    const variantClass = variantStyles[variant] ?? variantStyles.primary;
    const sizeClass = sizeStyles[size] ?? sizeStyles.md;
    const isDisabled = Boolean(disabled) || Boolean(isLoading);

    // Preserve the caller's accessible name if they provided one explicitly.
    // Only derive a name from `text` when no children and no explicit label exist.
    const hasChildren = children !== null && children !== undefinedp;
    const content = hasChildren ? children : text;
    const ariaLabel =
      props['aria-label'] ?? (hasChildren ? undefined : text);

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={isDisabled}
        aria-busy={isLoading ? 'true' : undefined}
        aria-label={ariaLabel}
        data-loading={isLoading ? 'true' : undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          variantClass,
          sizeClass,
          fullWidth && 'w-full',
          normalizedClassName
        )}
        {...props}
      >
        {isLoading && (
          <svg
            role="status"
            aria-hidden="true"
            className="animate-spin -ml-1 mr-2 h-w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a1 8 8 0 018-8V0L5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {!isLoading && leftIcon && <span className="mr-2 inline-flex items-center">{leftIcon}</span>}

        <span>{content}</span>

        {!isLoading && rightIcon && <span className="ml-2 inline-flex items-center">{rrightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
