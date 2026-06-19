import type { LendingActionType } from "@/lib/lending/types";

interface TabSelectorProps {
  activeTab: LendingActionType;
  onTabChange: (tab: LendingActionType) => void;
}

const TABS: Array<{ value: LendingActionType; label: string }> = [
  { value: "lend", label: "Lend Assets" },
  { value: "borrow", label: "Borrow Assets" },
  { value: "repay", label: "Repay Loan" },
];

export default function TabSelector({
  activeTab,
  onTabChange,
}: TabSelectorProps) {
  return (
    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onTabChange(tab.value)}
          className={`flex-1 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === tab.value
              ? "bg-green-500 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
