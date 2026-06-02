import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

export interface TooltipProps {
  /**
   * The content to display in the tooltip
   */
  content: string;
  /**
   * The trigger element (usually an IconButton)
   */
  children: React.ReactElement;
  /**
   * Position of the tooltip
   */
  position?: "top" | "bottom" | "left" | "right";
  /**
   * Delay in milliseconds before showing tooltip
   */
  delay?: number;
  /**
   * Additional CSS classes
   */
  className?: string;
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
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideTooltip();
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  // Clone the child and add event handlers
  const triggerElement = React.cloneElement(children, {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
    "aria-describedby": isVisible ? "tooltip-content" : undefined,
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div ref={triggerRef} className="relative inline-block">
      {triggerElement}

      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip-content"
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
