import axe from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { LendingData } from "@/app/lending/page";
import BorrowingForm from "@/components/features/lending/components/BorrowingForm";
import ConfirmModal from "@/components/features/lending/components/ConfirmModal";
import LendingForm from "@/components/features/lending/components/LendingForm";
import AssetSelector from "@/components/shared/ui/AssetSelector";
import { ASSETS } from "@/lib/assets";
import { render, screen } from "@/test/test-utils";

const lendingData: LendingData = {
  asset: "XLM",
  amount: 100,
  interestRate: 8.5,
};

const borrowingData: LendingData = {
  asset: "USDC",
  amount: 25,
  collateral: "XLM",
  collateralAmount: 50,
  duration: 30,
  interestRate: 10.5,
};

async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toEqual([]);
}

function OpenConfirmModal() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onConfirm={vi.fn()}
      data={lendingData}
      calculation={{ dailyEarnings: 0.03, totalEarnings: 4.2 }}
      type="lend"
    />
  );
}

describe("lending form accessibility", () => {
  it("has no automated axe violations in the lending form", async () => {
    const { container } = render(
      <LendingForm initialData={lendingData} onSubmit={vi.fn()} />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no automated axe violations in the borrowing form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prices: {
            XLM: 0.12,
            USDC: 1,
            BTC: 65000,
            ETH: 3500,
          },
        }),
      }),
    );

    const { container } = render(
      <BorrowingForm initialData={borrowingData} onSubmit={vi.fn()} />,
    );

    await expectNoAxeViolations(container);
    vi.unstubAllGlobals();
  });

  it("has no automated axe violations in the shared asset selector", async () => {
    const { container } = render(
      <AssetSelector
        assets={ASSETS}
        value="XLM"
        label="Select collateral asset"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("listbox", { name: /select collateral asset/i })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("has no automated axe violations in the confirmation modal", async () => {
    const { container } = render(<OpenConfirmModal />);

    expect(screen.getByRole("dialog", { name: /confirm lending transaction/i })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
