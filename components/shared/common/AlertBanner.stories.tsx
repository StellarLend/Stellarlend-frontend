import type { Meta, StoryObj } from "@storybook/react";
import { AlertBanner } from "./AlertBanner";

const meta: Meta<typeof AlertBanner> = {
  title: "Shared/Common/AlertBanner",
  component: AlertBanner,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A top-of-dashboard alert banner with informational, warning, and critical severities. " +
          "The banner uses icons and text labels instead of color alone, and it can be dismissed with persistence via localStorage.",
      },
    },
  },
  argTypes: {
    severity: {
      control: "select",
      options: ["info", "warning", "critical"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof AlertBanner>;

export const Information: Story = {
  args: {
    title: "Next payment is due soon",
    message: "Your next payment of $250.00 is due in 4 days. Keep an eye on your collateral health.",
    severity: "info",
    dismissKey: "storybook-alert-info",
  },
};

export const Warning: Story = {
  args: {
    title: "Collateral health is weakening",
    message: "Your health factor is below 1.25. A payment due within 3 days could increase liquidation risk.",
    severity: "warning",
    dismissKey: "storybook-alert-warning",
  },
};

export const Critical: Story = {
  args: {
    title: "Immediate action required",
    message: "Your health factor is critical and your next payment is due in 1 day. Add collateral or repay now.",
    severity: "critical",
    dismissKey: "storybook-alert-critical",
  },
};
