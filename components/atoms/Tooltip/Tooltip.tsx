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

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 300,
  className,
  wrapperClassName,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);
  const isDismissedRef = useRef(false);
  const tooltipId = useId();
  const normalizedDelay = Number.isFinite(delay) && delay >= 0 ? delay : 0;

  const clearShowTimeout = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleShow = () => {
    clearShowTimeout();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsVisible(true);
    }, normalizedDelay);
  };

  const activate = (interaction: "hover" | "focus") => {
    const wasActive = isHoveredRef.current || isFocusedRef.current;
    if (interaction === "hover") isHoveredRef.current = true;
    else isFocusedRef.current = true;

    if (!wasActive && !isDismissedRef.current) scheduleShow();
  };

  const deactivate = (interaction: "hover" | "focus") => {
    if (interaction === "hover") isHoveredRef.current = false;
    else isFocusedRef.current = false;

    if (!isHoveredRef.current && !isFocusedRef.current) {
      clearShowTimeout();
      setIsVisible(false);
      isDismissedRef.current = false;
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        (!isHoveredRef.current && !isFocusedRef.current && timeoutRef.current === null)
      ) {
        return;
      }

      clearShowTimeout();
      setIsVisible(false);
      isDismissedRef.current = true;
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      clearShowTimeout();
    };
  }, []);

  const childProps = children.props as React.HTMLAttributes<HTMLElement>;
  const describedBy = (childProps["aria-describedby"] ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (isVisible && !describedBy.includes(tooltipId)) describedBy.push(tooltipId);

  const triggerElement = React.cloneElement(children, {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(event);
      activate("hover");
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      childProps.onMouseLeave?.(event);
      deactivate("hover");
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(event);
      activate("focus");
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      deactivate("focus");
    },
    "aria-describedby": describedBy.length > 0 ? describedBy.join(" ") : undefined,
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div className={cn("relative", wrapperClassName ?? "inline-block")}>
      {triggerElement}

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            // Base styles
            "absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg",
            "pointer-events-none opacity-0 transition-opacity duration-200",

            // Position
            positionClasses[position],

            // Arrow
            "after:content-[''] after:absolute after:w-0 after:h-0",
            "after:border-l-4 after:border-r-4 after:border-b-4 after:border-transparent after:border-b-gray-900",
            arrowClasses[position],

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
