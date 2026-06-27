import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import HealthFactorBadge from "./HealthFactorBadge";

describe("HealthFactorBadge", () => {
  it("renders the cleared state when debt is fully repaid", () => {
    render(<HealthFactorBadge healthFactor={Infinity} />);

    expect(screen.getByText("Debt cleared")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-health-band",
      "cleared",
    );
  });

  it("treats exactly 2.0 as healthy", () => {
    render(<HealthFactorBadge healthFactor={2} />);

    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-health-band",
      "healthy",
    );
  });

  it("treats exactly 1.0 as at risk", () => {
    render(<HealthFactorBadge healthFactor={1} />);

    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-health-band",
      "at-risk",
    );
  });

  it("renders critical state below the liquidation threshold", () => {
    render(<HealthFactorBadge healthFactor={0.99} />);

    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-health-band",
      "critical",
    );
  });
});
