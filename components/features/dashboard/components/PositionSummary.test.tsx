import React from "react";
import { render, screen } from "@/test/test-utils";
import PositionSummary from "./PositionSummary";
import { describe, it, expect } from "vitest";

describe("PositionSummary Component", () => {
  const mockHealthyData = {
    suppliedFunds: "$5,000.00 XLM",
    borrowedAmount: "$1,500.00 XLM",
    healthFactor: 2.5,
  };

  const mockAtRiskData = {
    suppliedFunds: "$5,000.00 XLM",
    borrowedAmount: "$3,500.00 XLM",
    healthFactor: 1.5,
  };

  const mockCriticalData = {
    suppliedFunds: "$5,000.00 XLM",
    borrowedAmount: "$5,500.00 XLM",
    healthFactor: 0.8,
  };

  describe("Rendering", () => {
    it("renders with healthy position data", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByText("Net Position")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();
      expect(screen.getByText("Your position is well-protected")).toBeInTheDocument();
    });

    it("renders with at-risk position data", () => {
      render(<PositionSummary data={mockAtRiskData} />);

      expect(screen.getByText("At Risk")).toBeInTheDocument();
      expect(screen.getByText("Consider reducing borrowed amount")).toBeInTheDocument();
    });

    it("renders with critical position data", () => {
      render(<PositionSummary data={mockCriticalData} />);

      expect(screen.getByText("Critical")).toBeInTheDocument();
      expect(screen.getByText("Risk of liquidation - take action")).toBeInTheDocument();
    });

    it("renders null data gracefully", () => {
      render(<PositionSummary data={null} />);

      expect(screen.getByText("Unable to load position summary")).toBeInTheDocument();
    });

    it("renders loading state", () => {
      render(<PositionSummary data={mockHealthyData} isLoading={true} />);

      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Loading position summary"
      );
    });

    it("renders loading state when data is null and isLoading is true", () => {
      render(<PositionSummary data={null} isLoading={true} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("Net Position Calculation", () => {
    it("calculates positive net position correctly", () => {
      render(<PositionSummary data={mockHealthyData} />);

      // Net: $5,000 - $1,500 = $3,500
      expect(screen.getByLabelText(/Net position: \$3,500\.00/)).toBeInTheDocument();
    });

    it("calculates negative net position correctly", () => {
      render(<PositionSummary data={mockCriticalData} />);

      // Net: $5,000 - $5,500 = -$500
      expect(screen.getByLabelText(/Net position: -\$500\.00/)).toBeInTheDocument();
    });

    it("displays positive net position message for healthy position", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByText("Supplied funds exceed borrowed amount")).toBeInTheDocument();
    });

    it("displays negative net position message for underwater position", () => {
      render(<PositionSummary data={mockCriticalData} />);

      expect(screen.getByText("Borrowed amount exceeds supplied funds")).toBeInTheDocument();
    });
  });

  describe("Health Status Indicator", () => {
    it("shows health factor as 2x or higher with two decimal places", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByText("2.50x")).toBeInTheDocument();
    });

    it("shows at-risk health factor correctly", () => {
      render(<PositionSummary data={mockAtRiskData} />);

      expect(screen.getByText("1.50x")).toBeInTheDocument();
    });

    it("shows critical health factor correctly", () => {
      render(<PositionSummary data={mockCriticalData} />);

      expect(screen.getByText("0.80x")).toBeInTheDocument();
    });

    it("updates health indicator colors based on status", () => {
      const { rerender } = render(<PositionSummary data={mockHealthyData} />);

      let healthCard = screen.getByRole("article");
      expect(healthCard).toHaveClass("bg-emerald-950");

      rerender(<PositionSummary data={mockAtRiskData} />);

      healthCard = screen.getByRole("article");
      expect(healthCard).toHaveClass("bg-amber-950");

      rerender(<PositionSummary data={mockCriticalData} />);

      healthCard = screen.getByRole("article");
      expect(healthCard).toHaveClass("bg-red-950");
    });
  });

  describe("Accessibility", () => {
    it("includes ARIA labels for semantic elements", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByRole("region")).toHaveAttribute("aria-label", "Position summary");
      expect(screen.getByRole("article")).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Health status")
      );
    });

    it("includes screen-reader-only summary", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const srOnly = screen.getByText(/Net position is/);
      expect(srOnly).toHaveClass("sr-only");
    });

    it("provides accessible health factor information", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByLabelText(/Health factor: 2\.50/)).toBeInTheDocument();
    });

    it("provides accessible breakdown information", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByLabelText(/Total supplied: \$5,000\.00 XLM/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Total borrowed: \$1,500\.00 XLM/)).toBeInTheDocument();
    });

    it("has proper heading hierarchy", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const healthLabel = screen.getByText("Healthy");
      expect(healthLabel.tagName).toBe("H3");
    });

    it("uses semantic HTML for the main container", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const mainContainer = screen.getByRole("region");
      expect(mainContainer).toBeInTheDocument();
    });

    it("provides status role for loading state", () => {
      render(<PositionSummary data={mockHealthyData} isLoading={true} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("provides alert role for error state", () => {
      render(<PositionSummary data={null} />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("Data Display and Formatting", () => {
    it("displays supplied funds correctly", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByText("$5,000.00 XLM")).toBeInTheDocument();
    });

    it("displays borrowed amount correctly", () => {
      render(<PositionSummary data={mockHealthyData} />);

      expect(screen.getByText("$1,500.00 XLM")).toBeInTheDocument();
    });

    it("handles currency values with commas", () => {
      const dataWithLargeValues = {
        suppliedFunds: "$1,250,000.50 XLM",
        borrowedAmount: "$500,000.75 XLM",
        healthFactor: 2.0,
      };

      render(<PositionSummary data={dataWithLargeValues} />);

      // Net should be $750,000.25 (after formatting)
      expect(screen.getByText("$1,250,000.50 XLM")).toBeInTheDocument();
      expect(screen.getByText("$500,000.75 XLM")).toBeInTheDocument();
    });

    it("handles edge case with zero borrowed amount", () => {
      const zeroDebtData = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$0.00 XLM",
        healthFactor: Number.POSITIVE_INFINITY,
      };

      render(<PositionSummary data={zeroDebtData} />);

      expect(screen.getByText("$5,000.00 XLM")).toBeInTheDocument();
      expect(screen.getByText("$0.00 XLM")).toBeInTheDocument();
    });

    it("handles edge case with equal supplied and borrowed", () => {
      const balancedData = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$5,000.00 XLM",
        healthFactor: 1.0,
      };

      render(<PositionSummary data={balancedData} />);

      // Net should be $0.00
      expect(screen.getByLabelText(/Net position: \$0\.00/)).toBeInTheDocument();
    });
  });

  describe("Health Status Thresholds", () => {
    it("marks position as healthy with 2.0x factor", () => {
      const boundaryHealthy = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$1,500.00 XLM",
        healthFactor: 2.0,
      };

      render(<PositionSummary data={boundaryHealthy} />);

      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });

    it("marks position as at-risk with 1.99x factor", () => {
      const boundaryAtRisk = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$1,500.00 XLM",
        healthFactor: 1.99,
      };

      render(<PositionSummary data={boundaryAtRisk} />);

      expect(screen.getByText("At Risk")).toBeInTheDocument();
    });

    it("marks position as at-risk with 1.0x factor", () => {
      const boundaryAtRisk = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$1,500.00 XLM",
        healthFactor: 1.0,
      };

      render(<PositionSummary data={boundaryAtRisk} />);

      expect(screen.getByText("At Risk")).toBeInTheDocument();
    });

    it("marks position as critical with 0.99x factor", () => {
      const boundaryCritical = {
        suppliedFunds: "$5,000.00 XLM",
        borrowedAmount: "$1,500.00 XLM",
        healthFactor: 0.99,
      };

      render(<PositionSummary data={boundaryCritical} />);

      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it("displays correct icon for critical status", () => {
      render(<PositionSummary data={mockCriticalData} />);

      // Check for SVG - AlertCircle icon is used for critical
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("displays circle indicator for non-critical status", () => {
      render(<PositionSummary data={mockHealthyData} />);

      // For healthy/at-risk, a div with border-2 is used instead of AlertCircle
      const indicator = document.querySelector(".border-2");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("Edge Cases and Malformed Data", () => {
    it("handles malformed currency string gracefully", () => {
      const malformedData = {
        suppliedFunds: "invalid",
        borrowedAmount: "also invalid",
        healthFactor: 1.5,
      };

      render(<PositionSummary data={malformedData} />);

      // Should treat as $0.00
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });

    it("handles very small health factor", () => {
      const verySmallHF = {
        suppliedFunds: "$100.00 XLM",
        borrowedAmount: "$500.00 XLM",
        healthFactor: 0.001,
      };

      render(<PositionSummary data={verySmallHF} />);

      expect(screen.getByText("Critical")).toBeInTheDocument();
      expect(screen.getByText("0.00x")).toBeInTheDocument();
    });

    it("handles very large health factor", () => {
      const veryLargeHF = {
        suppliedFunds: "$1,000,000.00 XLM",
        borrowedAmount: "$100.00 XLM",
        healthFactor: 10000.0,
      };

      render(<PositionSummary data={veryLargeHF} />);

      expect(screen.getByText("Healthy")).toBeInTheDocument();
      expect(screen.getByText("10000.00x")).toBeInTheDocument();
    });
  });

  describe("Visual Consistency", () => {
    it("uses monospace font for numeric values", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const netPositionDisplay = screen.getByLabelText(/Net position:/);
      expect(netPositionDisplay).toHaveClass("font-mono");
    });

    it("maintains visual hierarchy with proper sizing", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const netPositionDisplay = screen.getByLabelText(/Net position:/);
      expect(netPositionDisplay).toHaveClass("text-5xl", "md:text-6xl");
    });

    it("applies consistent styling to breakdown cards", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const breakdownCards = screen.getAllByRole("region");
      expect(breakdownCards.length).toBeGreaterThan(0);
    });
  });

  describe("Responsive Behavior", () => {
    it("renders responsive padding", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const container = screen.getByRole("region");
      expect(container).toHaveClass("p-8", "md:p-12");
    });

    it("renders responsive text sizes", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const netPositionDisplay = screen.getByLabelText(/Net position:/);
      expect(netPositionDisplay).toHaveClass("text-5xl", "md:text-6xl");
    });

    it("renders responsive grid layout", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const grid = document.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-2");
    });
  });

  describe("Interactive States", () => {
    it("applies hover effects", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const container = screen.getByRole("region");
      expect(container).toHaveClass("hover:border-[#71B48D66]");
    });

    it("applies transition effects", () => {
      render(<PositionSummary data={mockHealthyData} />);

      const container = screen.getByRole("region");
      expect(container).toHaveClass("transition-colors");
    });
  });
});
