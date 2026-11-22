import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TwapChart } from "./twap-chart";

describe("TwapChart component", () => {
  it("renders empty state when there are fewer than 2 points", () => {
    const onWindowChange = () => {};
    render(<TwapChart points={[]} onWindowChange={onWindowChange} />);
    expect(screen.getByText(/Insufficient TWAP observations/i)).toBeInTheDocument();
  });

  it("renders price line and latest price when points >= 2", () => {
    const onWindowChange = () => {};
    const points = [
      { timestamp: 1000, price: "1.25" },
      { timestamp: 1060, price: "1.30" },
      { timestamp: 1120, price: "1.35" },
    ];
    render(<TwapChart points={points} onWindowChange={onWindowChange} />);
    expect(screen.getByText("1.35")).toBeInTheDocument();
    expect(screen.getByText("Latest TWAP")).toBeInTheDocument();
  });
});
