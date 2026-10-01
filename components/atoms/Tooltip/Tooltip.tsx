import React, { useState, useRef, useEffect, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
  wrapperClassName?: string;
}

/**
 * The delay is clamped to a non-negative finite number. Negative or NaN
 * values would otherwise cause `setTimeout` to fire immediately or in an
 * unpredictable order, breaking the delay contract.
 */
export const MAX_TOOLTIP_DELAY = 10 * 60 * 1000;

const positionClasses: Record<string, string> = {
  top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
  left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
  right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
};

const arrowClasses: Record<string, string> = {
  top: "top-full left-1/2 transform -translate-x-1/2 -mt-1",
  bottom: "bottom-full left-1/2 transform -translate-x-1/2 -mb-1",
  left: "left-full top-1/2 transform -translate-y-1/2 -ml-1",
  right: "right-full top-1/2 transform -translate-y-1/2 -mr-1",
};

/**
 * Resolves a valid position key, falling back to "top" for unknown values.
 * This guarantees `positionClasses`/`arrowClasses` lookups always resolve.
 */
function resolvePosition(position: TooltipProps["position"]): keyof typeof positionClasses {
  if (position && position in positionClasses) {
    return position as keyof typeof positionClasses;
  }
  return "top";
}

/**
 * Normalizes the delay input into a deterministic, non-negative ms value.
 * NaN/Infinity/negative inputs are coerced to 0 (immediate show), which is
 * the safest default and avoids unbounded timers.
 */
function normalizeDelay(delay: number | undefined): number {
  if (typeof delay !== "number" || !Number.finite(delay)) {
    return 0;
  }
  if (delay < 0) {
    return 0;
  }
  return Math.min(delay, MAX_TOOLTIP_DELAY);
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 300,
  className,
  wrapperClassName,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const tooltipId = `tooltip-${generatedId}`;

  // Stable reference so cleanup can always cancel the latest pending timer.
  const clearPendingTimeout = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showTooltip = React.useCallback(() => {
    clearPendingTimeout();
    const wait = normalizeDelay(delay);
    if (wait === 0) {
      // Avoid scheduling a macrotask for zero delay; show synchronously so
      // behavior is deterministic and testable without timer advancing.
      setIsVisible(true);
      return;
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsVisible(true);
    }, wait);
  }, [clearPendingTimeout, delay]);

  const hideTooltip = React.useCallback(() => {
    clearPendingTimeout();
    setIsVisible(false);
  }, [clearPendingTimeout]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideTooltip();
      }

      clearShowTimeout();
      setIsVisible(false);
      isDismissedRef.current = true;
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isVisible, hideTooltip]);

  // Cancel any pending timer on unmount to prevent state updates after disposal.
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  const safePosition = resolvePosition(position);

  const childProps = children.props as React.HTMLAttributes<HTMLElement>;
  const describedBy = (childProps["aria-describedby"] ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (isVisible && !describedBy.includes(tooltipId)) describedBy.push(tooltipId);

  const triggerElement = React.cloneElement(children, {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
    "aria-describedby": isVisible ? tooltipId : undefined,
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div className={cn("relative", wrapperClassName ?? "inline-block")}>
      {triggerElement}

      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={cn(
            // Base styles
            "absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg",
            "pointer-events-none opacity-0 transition-opacity duration-200",

            // Position
            positionClasses[safePosition],

            // Arrow
            "after:content-[''] after:absolute after:w-0 after:h-0",
            "after:border-l-4 after:border-r-4 after:border-b-4 after:border-transparent after:border-b-gray-900",
            arrowClasses[safePosition],

            // Show animation
            "opacity-100",

            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

Tooltip.displayName = "Tooltip";
