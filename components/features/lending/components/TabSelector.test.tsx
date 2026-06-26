import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import type { LendingActionType } from "@/lib/lending/types";
import TabSelector from "./TabSelector";

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

    const lendTab = screen.getByRole("tab", { name: /lend assets/i });
    lendTab.focus();

    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("borrow");
    expect(screen.getByRole("tab", { name: /borrow assets/i })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("repay");
    expect(screen.getByRole("tab", { name: /repay loan/i })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("lend");
    expect(screen.getByRole("tab", { name: /lend assets/i })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(onTabChange).toHaveBeenLastCalledWith("repay");
    expect(screen.getByRole("tab", { name: /repay loan/i })).toHaveAttribute("aria-selected", "true");
  });

  it("supports Home and End keyboard shortcuts", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<StatefulTabSelector initialTab="borrow" onTabChange={onTabChange} />);

    screen.getByRole("tab", { name: /borrow assets/i }).focus();

    await user.keyboard("{End}");
    expect(onTabChange).toHaveBeenLastCalledWith("repay");

    await user.keyboard("{Home}");
    expect(onTabChange).toHaveBeenLastCalledWith("lend");
  });
});
