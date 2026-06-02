import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PositionSummary } from "@/components/features/dashboard/components/PositionSummary";

/**
 * PositionSummary Component
 *
 * A dashboard hero component that displays the user's net lending position
 * (supplied minus borrowed) and account health status at a glance.
 *
 * The component intelligently calculates and presents:
 * - Net position: Total supplied funds minus total borrowed amount
 * - Health indicator: Visual and textual status based on health factor thresholds
 *   - Healthy: 2.0x or above (green indicator)
 *   - At Risk: 1.0x to 1.99x (amber indicator)
 *   - Critical: Below 1.0x (red indicator)
 *
 * Accessibility features included:
 * - ARIA labels and semantic HTML for screen readers
 * - High contrast health indicators with text labels
 * - Non-color-dependent status communication
 * - Screen reader only summary of position details
 */
const meta = {
  title: "Features/Dashboard/PositionSummary",
  component: PositionSummary,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PositionSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Healthy State - Account with comfortable cushion
 *
 * When health factor is 2.0x or above:
 * - Position is well-protected from liquidation
 * - Supplied amount significantly exceeds borrowed amount
 * - User can comfortably borrow more or withdraw supplies
 */
export const Healthy: Story = {
  args: {
    data: {
      suppliedFunds: "$10,000.00 XLM",
      borrowedAmount: "$3,500.00 XLM",
      healthFactor: 2.85,
    },
  },
};

/**
 * At-Risk State - Account approaching danger zone
 *
 * When health factor is between 1.0x and 1.99x:
 * - Position has adequate buffer but requires attention
 * - Further borrowing could push account into critical zone
 * - Recommended action: reduce borrowed amount or increase supply
 */
export const AtRisk: Story = {
  args: {
    data: {
      suppliedFunds: "$8,000.00 XLM",
      borrowedAmount: "$5,500.00 XLM",
      healthFactor: 1.45,
    },
  },
};

/**
 * Critical State - High liquidation risk
 *
 * When health factor is below 1.0x:
 * - Position faces immediate liquidation risk
 * - Must take urgent action to restore health
 * - Options: repay debt, deposit more collateral, or both
 */
export const Critical: Story = {
  args: {
    data: {
      suppliedFunds: "$5,000.00 XLM",
      borrowedAmount: "$5,200.00 XLM",
      healthFactor: 0.62,
    },
  },
};

/**
 * Loading State - While position data is being fetched
 *
 * Displays an animated skeleton loading state while
 * waiting for position data from the API.
 */
export const Loading: Story = {
  args: {
    data: null,
    isLoading: true,
  },
};

/**
 * Error State - When data fails to load
 *
 * Gracefully handles scenarios where position data
 * cannot be retrieved from the API.
 */
export const Error: Story = {
  args: {
    data: null,
    isLoading: false,
  },
};

/**
 * Boundary Case - At exactly 2.0x (Healthy threshold)
 *
 * Tests the boundary between "Healthy" and "At Risk"
 * Demonstrates that 2.0x exactly is classified as "Healthy"
 */
export const HealthyBoundary: Story = {
  args: {
    data: {
      suppliedFunds: "$6,000.00 XLM",
      borrowedAmount: "$2,000.00 XLM",
      healthFactor: 2.0,
    },
  },
};

/**
 * Boundary Case - At exactly 1.0x (At-Risk threshold)
 *
 * Tests the boundary between "At Risk" and "Critical"
 * Demonstrates that 1.0x is classified as "At Risk"
 */
export const AtRiskBoundary: Story = {
  args: {
    data: {
      suppliedFunds: "$5,000.00 XLM",
      borrowedAmount: "$3,000.00 XLM",
      healthFactor: 1.0,
    },
  },
};

/**
 * Net Positive Position - Supplied > Borrowed
 *
 * Demonstrates display of positive net position
 * with healthy health factor
 */
export const PositiveNetPosition: Story = {
  args: {
    data: {
      suppliedFunds: "$20,000.00 XLM",
      borrowedAmount: "$5,000.00 XLM",
      healthFactor: 3.5,
    },
  },
};

/**
 * Net Negative Position - Borrowed > Supplied
 *
 * Demonstrates display of negative net position
 * (underwater account) with critical health factor
 */
export const NegativeNetPosition: Story = {
  args: {
    data: {
      suppliedFunds: "$3,000.00 XLM",
      borrowedAmount: "$8,000.00 XLM",
      healthFactor: 0.38,
    },
  },
};

/**
 * Zero Debt Position - No borrowing
 *
 * User has supplied funds but hasn't borrowed anything
 * Health factor is infinite (represented as very large number)
 */
export const ZeroDebtPosition: Story = {
  args: {
    data: {
      suppliedFunds: "$15,000.00 XLM",
      borrowedAmount: "$0.00 XLM",
      healthFactor: 999.99,
    },
  },
};

/**
 * High Value Position - Large amounts
 *
 * Demonstrates proper formatting of large currency values
 * with thousands separators and alignment
 */
export const HighValuePosition: Story = {
  args: {
    data: {
      suppliedFunds: "$1,250,000.50 XLM",
      borrowedAmount: "$450,000.75 XLM",
      healthFactor: 2.78,
    },
  },
};

/**
 * Small Value Position - Minimal amounts
 *
 * Tests rendering with small dollar amounts
 * and proper decimal formatting
 */
export const SmallValuePosition: Story = {
  args: {
    data: {
      suppliedFunds: "$100.25 XLM",
      borrowedAmount: "$25.50 XLM",
      healthFactor: 2.15,
    },
  },
};

/**
 * Very Low Health Factor - Near liquidation
 *
 * Position with extremely low health factor
 * approaching total account collapse
 */
export const VeryLowHealthFactor: Story = {
  args: {
    data: {
      suppliedFunds: "$5,000.00 XLM",
      borrowedAmount: "$4,999.00 XLM",
      healthFactor: 0.001,
    },
  },
};

/**
 * Very High Health Factor - Heavily overcollateralized
 *
 * Position with extremely high health factor
 * demonstrating maximum safety
 */
export const VeryHighHealthFactor: Story = {
  args: {
    data: {
      suppliedFunds: "$100,000.00 XLM",
      borrowedAmount: "$1,000.00 XLM",
      healthFactor: 99.0,
    },
  },
};
