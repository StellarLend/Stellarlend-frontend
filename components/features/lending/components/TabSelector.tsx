import type { KeyboardEvent } from "react";
import type { LendingActionType } from "@/lib/lending/types";

interface TabSelectorProps {
  activeTab: LendingActionType;
  onTabChange: (tab: LendingActionType) => void;
}

const TABS: Array<{ value: LendingActionType; label: string }> = [
  { value: "lend", label: "Lend Assets" },
  { value: "borrow", label: "Borrow Assets" },
  { value: "repay", label: "Repay Loan" },
  { value: "withdraw", label: "Withdraw" },
];

export default function TabSelector({
  activeTab,
  onTabChange,
}: TabSelectorProps) {
  const focusTab = (value: LendingActionType) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-tab-value="${value}"]`)
        ?.focus();
    });
  };

  const selectTab = (value: LendingActionType) => {
    onTabChange(value);
    focusTab(value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = TABS.length - 1;
    let nextIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    selectTab(TABS[nextIndex].value);
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
            id={`lending-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`lending-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            data-tab-value={tab.value}
            onClick={() => onTabChange(tab.value)}
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
