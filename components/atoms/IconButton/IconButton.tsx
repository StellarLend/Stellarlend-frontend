import React, { forwardRef, useCallback, useId, useState } from "react";
import { cn } from "../../../lib/utils/cn";
import { navClasses } from "../../../constants/design-tokens";

export interface IconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
    "aria-label": string;
    /**
     * Text shown in an accessible tooltip on hover/focus. The tooltip is
     * wired to the button through `aria-describedby`, so assistive technology
     * announces it without polluting the button's accessible name.
     */
    tooltip?: string;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "ghost" | "outline";
    loading?: boolean;
}

const sizeClasses = {
    sm: "p-1.5 w-8 h-8",
    md: "p-2 w-10 h-10",
    lg: "p-3 w-12 h-12",
} as const;

const variantClasses = {
    default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    ghost: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
    outline:
        "text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900",
} as const;

/**
 * Icon-only control.
 *
 * Determinism notes:
 * - The underlying `<button>` already activates on Enter/Space, so no
 *   synthetic `onKeyDown` click is dispatched here. Doing so would fire
 *   `onClick` twice per keypress in a real browser (once from the native
 *   activation, once from the handler) and could double-submit forms.
 * - `size`/`variant` are validated at compile time, but JS callers can still
 *   pass anything; unknown values fall back to the defaults instead of
 *   silently dropping all padding/colour.
 * - Keyboard activation is inert while `disabled`/`loading` because the
 *   native `disabled` attribute removes the button from the tab order and
 *   suppresses click events.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    (
        {
            className,
            children,
            "aria-label": ariaLabel,
            "aria-describedby": ariaDescribedBy,
            tooltip,
            size = "md",
            variant = "default",
            loading = false,
            disabled,
            onClick,
            onMouseEnter,
            onMouseLeave,
            onFocus,
            onBlur,
            ...props
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;
        const hasTooltip = typeof tooltip === "string" && tooltip.length > 0;
        const tooltipId = `${useId()}-tooltip`;
        const [tooltipVisible, setTooltipVisible] = useState(false);

        if (
            process.env.NODE_ENV !== "production" &&
            (typeof ariaLabel !== "string" || ariaLabel.trim().length === 0)
        ) {
            // Invalid input is reported once per render, in development only.
            // Never throw: a missing label must degrade to an unlabelled but
            // still operable control rather than crash the whole tree.
            console.warn(
                "[IconButton] `aria-label` is required and must be a non-empty string; " +
                    "icon-only controls are otherwise unusable with assistive technology.",
            );
        }

        // No tooltip means no state to flip: this keeps hover/focus on the
        // (many) plain icon buttons free of any re-render work.
        const showTooltip = useCallback(() => {
            if (hasTooltip) setTooltipVisible(true);
        }, [hasTooltip]);

        const hideTooltip = useCallback(() => setTooltipVisible(false), []);

        const resolvedSize = sizeClasses[size] ?? sizeClasses.md;
        const resolvedVariant = variantClasses[variant] ?? variantClasses.default;

        const describedBy =
            [ariaDescribedBy, hasTooltip ? tooltipId : null]
                .filter(Boolean)
                .join(" ") || undefined;

        const button = (
            <button
                ref={ref}
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-label={ariaLabel}
                aria-describedby={describedBy}
                onClick={onClick}
                onMouseEnter={(event) => {
                    onMouseEnter?.(event);
                    showTooltip();
                }}
                onFocus={(event) => {
                    onFocus?.(event);
                    showTooltip();
                }}
                onBlur={(event) => {
                    onBlur?.(event);
                    hideTooltip();
                }}
                onMouseLeave={(event) => {
                    onMouseLeave?.(event);
                    hideTooltip();
                }}
                className={cn(
                    "inline-flex items-center justify-center rounded-md transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    resolvedSize,
                    resolvedVariant,
                    navClasses.iconButtonFocusClasses,
                    className,
                )}
                {...props}
            >
                {loading ? (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
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

        // Existing callers that do not pass `tooltip` keep the exact same DOM
        // (a bare <button>), so this is purely additive.
        if (!hasTooltip) {
            return button;
        }

        return (
            <span className="relative inline-flex">
                {button}
                <span
                    id={tooltipId}
                    role="tooltip"
                    className={cn(
                        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2",
                        "whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg",
                        "transition-opacity duration-150",
                        tooltipVisible ? "opacity-100" : "opacity-0",
                    )}
                >
                    {tooltip}
                </span>
            </span>
        );
    },
);

IconButton.displayName = "IconButton";
