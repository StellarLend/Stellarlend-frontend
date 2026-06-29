"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook to detect if the user has requested reduced motion.
 * Safe for Server-Side Rendering (SSR) to prevent hydration mismatches.
 */
export function useReducedMotion(): boolean {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    // Avoid running on server side or environments without matchMedia
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setShouldReduce(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduce(e.matches);
    };

    // Use standard addEventListener or fall back to addListener for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return shouldReduce;
}
