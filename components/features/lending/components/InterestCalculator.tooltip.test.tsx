import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    return function DynamicImportedComponent(props: any) {
      const [Loaded, setLoaded] =
        React.useState<React.ComponentType<any> | null>(null);

      React.useEffect(() => {
        loader().then((module) => setLoaded(() => module.default));
      }, []);

      if (!Loaded) {
        return <div>Loading…</div>;
      }

      return <Loaded {...props} />;
    };
  },
}));

import InterestCalculator from "@/components/features/lending/components/InterestCalculator";

// Mock the calculation quote function
vi.mock("@/lib/lending/quote", () => ({
  calculateQuote: vi.fn(() => ({
    ok: true,
    result: {
      dailyEarnings: 1.23,
      totalEarnings: 12.34,
      monthlyPayment: 100.5,
      totalRepayment: 1200.75,
    },
  })),
}));

test("renders help icons with tooltips", async () => {
  const data = { amount: 1000, interestRate: 5, duration: 30 } as any;
  render(<InterestCalculator data={data} type="lend" onCalculate={() => {}} />);

  // Wait for calculation to appear
  const helpIcon = await screen.findAllByLabelText("Help");
  expect(helpIcon.length).toBeGreaterThan(0);

  // Hover over first help icon to show tooltip
  fireEvent.mouseOver(helpIcon[0]);
  const tooltip = await screen.findByText(
    "Estimated earnings per day based on APR and amount.",
  );
  expect(tooltip).toBeInTheDocument();
});

test("lazy-loads amortization schedule for borrow mode", async () => {
  const data = { amount: 1000, interestRate: 5, duration: 30 } as any;
  render(
    <InterestCalculator data={data} type="borrow" onCalculate={() => {}} />,
  );

  await waitFor(() => {
    expect(
      screen.getByRole("table", { name: /Amortization schedule/i }),
    ).toBeInTheDocument();
  });

  expect(screen.getByText("Monthly Payment")).toBeInTheDocument();
  expect(screen.getByText("Total Interest")).toBeInTheDocument();
});
