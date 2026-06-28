import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AmortizationSchedule from "./AmortizationSchedule";
import type { AmortizationSchedule as AmortizationScheduleType } from "@/lib/lending/amortization";

const mockSchedule: AmortizationScheduleType = {
  periods: [
    {
      period: 1,
      principal: 200,
      interest: 10,
      remainingBalance: 790,
    },
    {
      period: 2,
      principal: 205,
      interest: 5,
      remainingBalance: 585,
    },
    {
      period: 3,
      principal: 210,
      interest: 0,
      remainingBalance: 375,
    },
  ],
  monthlyPayment: 210,
  totalInterest: 15,
  totalRepayment: 615,
};

describe("AmortizationSchedule component", () => {
  it("renders schedule summary correctly", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    expect(screen.getByText("Monthly Payment")).toBeInTheDocument();
    expect(screen.getByText("$210.00")).toBeInTheDocument();
    expect(screen.getByText("Total Interest")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.getByText("Total Repayment")).toBeInTheDocument();
    expect(screen.getByText("$615.00")).toBeInTheDocument();
  });

  it("renders all periods in the table", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    expect(screen.getByTestId("period-1")).toBeInTheDocument();
    expect(screen.getByTestId("period-2")).toBeInTheDocument();
    expect(screen.getByTestId("period-3")).toBeInTheDocument();
  });

  it("displays correct values for each period", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    // Check first period
    expect(screen.getByTestId("period-1")).toHaveTextContent("1");
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$790.00")).toBeInTheDocument();
  });

  it("shows expand button for long schedules", () => {
    const longSchedule: AmortizationScheduleType = {
      ...mockSchedule,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: i + 1,
        principal: 200,
        interest: 10,
        remainingBalance: 1000 - (i + 1) * 200,
      })),
    };

    render(<AmortizationSchedule schedule={longSchedule} />);

    expect(screen.getByText(/Show Full Schedule/)).toBeInTheDocument();
    expect(screen.getByText(/12 periods/)).toBeInTheDocument();
  });

  it("expands schedule when button is clicked", () => {
    const longSchedule: AmortizationScheduleType = {
      ...mockSchedule,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: i + 1,
        principal: 200,
        interest: 10,
        remainingBalance: 1000 - (i + 1) * 200,
      })),
    };

    render(<AmortizationSchedule schedule={longSchedule} />);

    const expandButton = screen.getByText(/Show Full Schedule/);
    fireEvent.click(expandButton);

    expect(screen.getByText("Show Less")).toBeInTheDocument();
  });

  it("collapses schedule when button is clicked again", () => {
    const longSchedule: AmortizationScheduleType = {
      ...mockSchedule,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: i + 1,
        principal: 200,
        interest: 10,
        remainingBalance: 1000 - (i + 1) * 200,
      })),
    };

    render(<AmortizationSchedule schedule={longSchedule} />);

    const expandButton = screen.getByText(/Show Full Schedule/);
    fireEvent.click(expandButton);
    expect(screen.getByText("Show Less")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Show Less"));
    expect(screen.getByText(/Show Full Schedule/)).toBeInTheDocument();
  });

  it("shows collapsed indicator for long schedules", () => {
    const longSchedule: AmortizationScheduleType = {
      ...mockSchedule,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: i + 1,
        principal: 200,
        interest: 10,
        remainingBalance: 1000 - (i + 1) * 200,
      })),
    };

    render(<AmortizationSchedule schedule={longSchedule} />);

    expect(screen.getByText(/8 more periods/)).toBeInTheDocument();
  });

  it("does not show expand button for short schedules", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    expect(screen.queryByText(/Show Full Schedule/)).not.toBeInTheDocument();
  });

  it("has accessible table semantics", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    const table = screen.getByRole("table", { name: /Amortization schedule/ });
    expect(table).toBeInTheDocument();

    expect(screen.getByText("Period")).toHaveAttribute("scope", "col");
    expect(screen.getByText("Principal")).toHaveAttribute("scope", "col");
    expect(screen.getByText("Interest")).toHaveAttribute("scope", "col");
    expect(screen.getByText("Payment")).toHaveAttribute("scope", "col");
    expect(screen.getByText("Balance")).toHaveAttribute("scope", "col");
  });

  it("has proper aria attributes on expand button", () => {
    const longSchedule: AmortizationScheduleType = {
      ...mockSchedule,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: i + 1,
        principal: 200,
        interest: 10,
        remainingBalance: 1000 - (i + 1) * 200,
      })),
    };

    render(<AmortizationSchedule schedule={longSchedule} />);

    const expandButton = screen.getByRole("button", {
      name: /Show Full Schedule/,
    });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(expandButton).toHaveAttribute(
      "aria-controls",
      "amortization-schedule-table",
    );

    fireEvent.click(expandButton);
    expect(expandButton).toHaveAttribute("aria-expanded", "true");
  });

  it("calculates payment total correctly for each row", () => {
    render(<AmortizationSchedule schedule={mockSchedule} />);

    // First period: principal 200 + interest 10 = 210
    const firstPeriodRow = screen.getByTestId("period-1").closest("tr");
    expect(firstPeriodRow).toHaveTextContent("$210.00");
  });

  it("handles zero remaining balance correctly", () => {
    const scheduleWithZeroBalance: AmortizationSchedule = {
      ...mockSchedule,
      periods: [
        {
          period: 1,
          principal: 1000,
          interest: 10,
          remainingBalance: 0,
        },
      ],
    };

    render(<AmortizationSchedule schedule={scheduleWithZeroBalance} />);

    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });
});
