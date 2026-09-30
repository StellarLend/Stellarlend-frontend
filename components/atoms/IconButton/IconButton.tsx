import React, { forwardRef } from "react";
import { cn } from "../../../lib/utils/cn";
import { navClasses } from "../../../constants/design-tokens";

export interface IconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    /**
     * Required accessible label for screen readers.
     *
     * Invariant: must be a non-empty string. An empty or missing label
     * renders the button inaccessible to assistive technology. A dev-mode
     * warning is emitted at render time if this invariant is violated.
     */
    "aria-label": string;
    /**
     * Tooltip text for the button. Currently rendered as a native `title`
     * attribute so it appears as a browser tooltip on hover; it also serves
     * as a fallback accessible name when aria-label is absent (though
     * aria-label should always be provided explicitly).
     */
    tooltip?: string;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "ghost" | "outline";
    loading?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm: "p-1.5 w-8 h-8",
    md: "p-2 w-10 h-10",
    lg: "p-3 w-12 h-12",
};

const variantClasses: Record<string, string> = {
    default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    ghost: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
    outline:
        "text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900",
};

/**
 * Fallback classes used when an unknown size or variant key is supplied,
 * so the button always renders with sensible defaults instead of stripping
 * all size/variant classes silently.
 */
const FALLBACK_SIZE_CLASS = sizeClasses.md;
const FALLBACK_VARIANT_CLASS = variantClasses.default;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    (
        {
            className,
            children,
            size = "md",
            variant = "default",
            loading = false,
            disabled,
            onClick,
            tooltip,
            // Destructure aria-label so it is always present in the rendered
            // element even when the consumer provides it via spread.
            "aria-label": ariaLabel,
            onKeyDown: callerOnKeyDown,
            ...props
        },
        ref,
    ) => {
        // ── Invariant: aria-label must be a non-empty string ─────────────────
        // TypeScript enforces presence at compile time but cannot prevent an
        // empty string or a runtime-only bypass (e.g. as any). Emit a warning
        // in development so violations surface early without crashing users in
        // production.
        if (process.env.NODE_ENV !== "production") {
            if (!ariaLabel || ariaLabel.trim() === "") {
                console.warn(
                    "[IconButton] Missing or empty `aria-label`. Every IconButton " +
                    "must have a non-empty aria-label for screen-reader accessibility. " +
                    "Provide a concise description of the button's action.",
                );
            }
        }

        const isDisabled = disabled || loading;

        const handleKeyDown = (
            e: React.KeyboardEvent<HTMLButtonElement>,
        ) => {
            if (isDisabled) return;

            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.(e as any);
            }

            // Always delegate to any caller-supplied handler so consumer
            // logic (e.g. closing a menu on Escape) is never silently dropped.
            callerOnKeyDown?.(e);
        };

        // Resolve size and variant classes with safe fallbacks so that an
        // invalid/unknown value never produces undefined in the class string.
        const resolvedSizeClass = sizeClasses[size] ?? FALLBACK_SIZE_CLASS;
        const resolvedVariantClass = variantClasses[variant] ?? FALLBACK_VARIANT_CLASS;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                aria-label={ariaLabel}
                onKeyDown={handleKeyDown}
                onClick={onClick}
                // Render tooltip as a native title attribute so it appears on
                // hover and is available to assistive technology as a
                // supplementary description.
                title={tooltip}
                className={cn(
                    "inline-flex items-center justify-center rounded-md transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    resolvedSizeClass,
                    resolvedVariantClass,
                    navClasses.iconButtonFocusClasses,
                    className,
                )}
                {...props}
                // Invariant: always override whatever the caller spread;
                // a button that may be nested in a <form> must never
                // accidentally submit it.
                type="button"
                // aria-disabled is set after the spread for the same reason.
                aria-disabled={isDisabled || undefined}
            >
                {loading ? (
                    <svg
                        aria-hidden="true"
                        className="animate-spin h-4 w-4"
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
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                ) : (
                    children
                )}
            </button>
        );
    },
);

IconButton.displayName = "IconButton";
