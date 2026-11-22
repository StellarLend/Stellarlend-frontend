import React from "react";
import Link from "next/link";
import { cn } from "./utils";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "btn",
  ghost: "btn-ghost",
  danger: "border border-red-500/50 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:border-red-400 font-medium rounded-[10px]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1",
  md: "",
  lg: "text-base px-6 py-3",
};

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      href,
      target,
      rel,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseClass = cn(
      "inline-flex items-center justify-center transition-colors cursor-pointer select-none",
      variantStyles[variant],
      sizeStyles[size],
      loading && "opacity-70 cursor-wait",
      disabled && "opacity-50 cursor-not-allowed",
      className
    );

    const content = (
      <>
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {children}
      </>
    );

    if (href) {
      if (isDisabled) {
        return (
          <span
            ref={ref as React.Ref<HTMLSpanElement>}
            className={baseClass}
            aria-disabled="true"
            aria-busy={loading ? "true" : undefined}
            role="link"
          >
            {content}
          </span>
        );
      }
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={baseClass}
          target={target}
          rel={rel}
          aria-busy={loading ? "true" : undefined}
          onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={props.type || "button"}
        className={baseClass}
        disabled={isDisabled}
        aria-busy={loading ? "true" : undefined}
        onClick={isDisabled ? undefined : onClick}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
