import React, { forwardRef } from "react";
import { cn } from "../../../lib/utils/cn";
import { navClasses } from "../../../constants/design-tokens";

export interface IconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    "aria-label": string;
    tooltip?: string;
    size?: "sm" | "md" | "lg";
    variant?: "default" | "ghost" | "outline";
    loading?: boolean;
}

const sizeClasses = {
    sm: "p-1.5 w-8 h-8",
    md: "p-2 w-10 h-10",
    lg: "p-3 w-12 h-12",
};

const variantClasses = {
    default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    ghost: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
    outline:
        "text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900",
};

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
            ...props
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;

        const handleKeyDown = (
            e: React.KeyboardEvent<HTMLButtonElement>,
        ) => {
            if (isDisabled) return;

            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.(e as any);
            }
        };

        return (
            <button
                ref={ref}
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                onKeyDown={handleKeyDown}
                onClick={onClick}
                className={cn(
                    "inline-flex items-center justify-center rounded-md transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    sizeClasses[size],
                    variantClasses[variant],
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