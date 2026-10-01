import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import type { LendingActionType } from "@/lib/lending/types";
import TabSelector from "./TabSelector";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function StatefulTabSelector({
  initialTab = "lend",
  onTabChange = () => undefined,
}: {
  initialTab?: LendingActionType;
  onTabChange?: (tab: LendingActionType) => void;
}) {
  const [activeTab, setActiveTab] = useState<LendingActionType>(initialTab);

  return (
    <TabSelector
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        onTabChange(tab);
      }}
    />
  );
}

// Mirrors the parseTab() helper in app/lending/page.tsx so we can test it
// independently without importing the Next.js page (which requires a router).
const VALID_TABS: LendingActionType[] = ["lend", "borrow", "repay", "withdraw"];
function parseTab(value: string | null): LendingActionType {
  return VALID_TABS.includes(value as LendingActionType)
    ? (value as LendingActionType)
    : "lend";
}

// Thin wrapper that simulates how page.tsx binds TabSelector to a mock router.
function RouterBoundTabSelector({
  initialParam,
  onReplace,
}: {
  initialParam: string | null;
  onReplace: (url: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<LendingActionType>(() =>
    parseTab(initialParam),
  );

  const handleTabChange = (tab: LendingActionType) => {
    setActiveTab(tab);
    onReplace(`?tab=${tab}`);
  };

  return <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />;
}

// -----------------------------------------------------------------------------
// Existing tests
// -----------------------------------------------------------------------------

describe("TabSelector", () => {
  it("renders a labelled tablist with all lending action tabs", () => {
    render(<TabSelector activeTab="lend" onTabChange={() => undefined} />);

    expect(screen.getByRole("tablist", { name: /lending action/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /lend assets/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /borrow assets/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /repay loan/i })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onTabChange with the selected tab when clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<TabSelector activeTab="lend" onTabChange={onTabChange} />);

    await user.click(screen.getByRole("tab", { name: /borrow assets/i }));
    await user.click(screen.getByRole("tab", { name: /repay loan/i }));

    expect(onTabChange).toHaveBeenNthCalledWith(1, "borrow");
    expect(onTabChange).toHaveBeenNthCalledWith(2, "repay");
  });

  it("keeps only the active tab in the roving tab stop", () => {
    render(<TabSelector activeTab="borrow" onTabChange={() => undefined} />);

    expect(screen.getByRole("tab", { name: /lend assets/i })).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByRole("tab", { name: /borrow assets/i })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("tab", { name: /repay loan/i })).toHaveAttribute("tabIndex", "-1");
  });

  it("moves selection with arrow keys and wraps at the ends", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<StatefulTabSelector onTabChange={onTabChange} />);

    screen.getByRole("tab", { name: /lend assets/i }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("borrow");
    expect(screen.getByRole("tab", { name: /borrow assets/i })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: /borrow assets/i }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("repay");
    expect(screen.getByRole("tab", { name: /repay loan/i })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: /repay loan/i }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("withdraw");
    expect(screen.getByRole("tab", { name: /withdraw/i })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: /withdraw/i }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("lend");
    expect(screen.getByRole("tab", { name: /lend assets/i })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("tab", { name: /lend assets/i }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onTabChange).toHaveBeenLastCalledWith("withdraw");
    expect(screen.getByRole("tab", { name: /withdraw/i })).toHaveAttribute("aria-selected", "true");
  });

  it("supports Home and End keyboard shortcuts", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<StatefulTabSelector initialTab="borrow" onTabChange={onTabChange} />);

    screen.getByRole("tab", { name: /borrow assets/i }).focus();

    await user.keyboard("{End}");
    expect(onTabChange).toHaveBeenLastCalledWith("withdraw");

    screen.getByRole("tab", { name: /withdraw/i }).focus();
    await user.keyboard("{Home}");
    expect(onTabChange).toHaveBeenLastCalledWith("lend");
  });
});

// -----------------------------------------------------------------------------
// Deep-link / URL param edge-case tests
// -----------------------------------------------------------------------------

describe("parseTab (deep-link URL param validation)", () => {
  it.each<[string | null, LendingActionType]>([]);
});
