import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { describe, it, beforeEach, expect } from "vitest";
import HealthFactorAlert from "./HealthFactorAlert";

describe("HealthFactorAlert", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not render for healthy or missing health factors", () => {
    const { rerender } = render(<HealthFactorAlert healthFactor={2} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<HealthFactorAlert healthFactor={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a warning alert with repayment and collateral actions for at-risk health", async () => {
    render(<HealthFactorAlert healthFactor={1.5} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Collateral health is weakening");
    expect(alert).toHaveTextContent("1.50x");
    expect(screen.getByRole("link", { name: /repay debt/i })).toHaveAttribute(
      "href",
      "/lending?tab=repay",
    );
    expect(screen.getByRole("link", { name: /add collateral/i })).toHaveAttribute(
      "href",
      "/lending?tab=borrow",
    );
  });

  it("renders a critical alert below the liquidation threshold", async () => {
    render(<HealthFactorAlert healthFactor={0.99} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Liquidation risk is critical");
    expect(alert).toHaveTextContent("below the 1.00x liquidation threshold");
  });

  it("stays dismissed for the same band but reappears when health worsens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HealthFactorAlert healthFactor={1.4} />);

    await user.click(await screen.findByRole("button", { name: /dismiss alert/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<HealthFactorAlert healthFactor={1.2} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<HealthFactorAlert healthFactor={0.9} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Liquidation risk is critical",
    );
  });
});
