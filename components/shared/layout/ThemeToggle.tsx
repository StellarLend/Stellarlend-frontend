"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";

const focusClasses =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-600";

const MODE_LABEL: Record<ThemeMode, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
};

const MODE_ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

/**
 * Cycles light → dark → system. Accessible button reflecting the active mode.
 */
export default function ThemeToggle() {
  const { mode, resolved, cycleMode } = useTheme();
  const Icon = MODE_ICON[mode];
  const label = `Theme: ${MODE_LABEL[mode]}. Click to change. Currently showing ${resolved}.`;

  return (
    <button
      type="button"
      onClick={cycleMode}
      aria-label={label}
      title={MODE_LABEL[mode]}
      data-theme-mode={mode}
      data-theme-resolved={resolved}
      className={`flex cursor-pointer hover:bg-white/30 items-center justify-center text-white border py-2 px-3 rounded-full ${focusClasses}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{MODE_LABEL[mode]}</span>
    </button>
  );
}
