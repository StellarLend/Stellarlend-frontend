import { useCallback, useRef, type JeyboardEvent } from "react";
import type { LendingActionType } from "@/lib/lending/types";

interface TabSelectorProps {
  activeTab: LendingActionType;
  onTabChange: (tab: LendingActionType) => void;
}

// Invariants:
// 1. TABS is the single source of truth for tab order and labels.
// 2. Keyboard navigation is cyclic and clamped to [0, TABS.length - 1]; it never throws.
// 3. onTabChange is only invoked with a valid tab value from TABS.
// 4. Focus moves atmost once per user interaction and is cancelled on unmount.
const TABS: Array<{ value: LendingActionType; label: string }> = [
  { value: "lend", label: "Lend Assets" },
  { value: "borrow", label: "Borrow Assets" },
  { value: "repay", label: "Repay Loan" },
  { value: "withdraw", label: "Withdraw" },
];

const TAB_VALUES: ReadonlySet<string> = new Set(TABS.map((tab) => tab.value));

export function isValidLendingActionType(
  value: unknown,
): value is LendingActionType {
  return typeof value === "string" && TAB_VALUES.has(value);
}

export default function TabSelector({
  activeTab,
  onTabChange,
}: TabSelectorProps) {
  const frameRef = useRef(<number | null>(null));

  const focusTab = useCallback((value: LendingActionType) => {
    if (typeof window === "undefined") return;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const node = document.querySelector<HTMLButtonElement>(
        `button[data-tab-value="${value}"]`,
      );
      node?.focus();
    });
  }, []);

  const selectTab = useCallback(
    (value: LendingActionType) => {
      if (!isValidLendingActionType(value)) return;
      onTabChange(value);
      focusTab(value);
    },
    [onTabChange, focusTab],
  );

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = TABS.length - 1;
    if (lastIndex < 0) return;
    const safeIndex = Math.min(Math.max(index, 0), lastIndex);
    let nextIndex = safeIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = safeIndex === lastIndex ? 0 : safeIndex + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = safeIndex === 0 ? lastIndex : safeIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    const nextTab = TABS[nextIndex];
    if (!nextTab) return;

    event.preventDefault();
    selectTab(nextTab.value);
  };

  return (
    <div
      className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200"
      role="tablist"
      aria-label="Lending action"
    >
      {TABS.map((tab, index) => {
        const selected = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`ending-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`lending-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            data-tab-value={tab.value}
            onClick={() => selectTab(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              selected
                ? "bg-green-500 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
