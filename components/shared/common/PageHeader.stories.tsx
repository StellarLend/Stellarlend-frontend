import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Shared/Common/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: "select",
      options: ["dark", "light"],
    },
    as: {
      control: "select",
      options: ["h1", "h2"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

const DarkBackground = (Story: React.ComponentType) => (
  <div className="bg-[#15A350] p-8">
    <Story />
  </div>
);

const LightBackground = (Story: React.ComponentType) => (
  <div className="bg-slate-50 p-8">
    <Story />
  </div>
);

export const Dashboard: Story = {
  args: {
    title: "Dashboard",
    description: "Track lending, borrowing, and collateral health at a glance.",
    tone: "dark",
  },
  decorators: [DarkBackground],
};

export const WithActions: Story = {
  args: {
    title: "Transactions",
    description: "All on-chain activity tied to your account.",
    tone: "dark",
    actions: (
      <button
        type="button"
        className="rounded-lg border border-[#71B48D] bg-[#15A350] px-4 py-2 text-sm font-semibold text-white"
      >
        Export CSV
      </button>
    ),
  },
  decorators: [DarkBackground],
};

export const Lending: Story = {
  args: {
    title: "Lending & Borrowing",
    description:
      "Earn interest by lending your assets or borrow against your collateral.",
    tone: "dark",
  },
  decorators: [
    (Story) => (
      <div className="bg-gradient-to-b from-green-700 to-black p-8">
        <Story />
      </div>
    ),
  ],
};

export const AccountLight: Story = {
  args: {
    title: "Profile",
    description:
      "Manage personal details, security, and notification preferences.",
    tone: "light",
  },
  decorators: [LightBackground],
};

export const TitleOnly: Story = {
  args: {
    title: "Settings",
    tone: "light",
  },
  decorators: [LightBackground],
};

// ---------------------------------------------------------------------------
// Boundary & Failure-Path Scenarios
// ---------------------------------------------------------------------------

/** Extreme content length boundary: tests flex wrapping, overflow safety, and multiline readability */
export const LongContentBoundary: Story = {
  args: {
    title:
      "Ultra-Long Enterprise Decentralized Asset Collateralization Liquidity & Automated Cross-Chain Settlement Protocol Dashboard",
    description:
      "This comprehensive overview provides multi-tenant telemetry and cross-jurisdictional compliance metrics across thousands of concurrent loans, active collateral pools, real-time oracle price feeds, liquidation thresholds, and automated flash-loan defense invariants without breaking responsiveness.",
    tone: "dark",
  },
  decorators: [DarkBackground],
};

/** Special characters & symbols boundary: verifies ID sanitization and safe text rendering */
export const SpecialCharactersBoundary: Story = {
  args: {
    title: '<script>alert("xss")</script> & Collateral $#@! 🎉 "Quotes" / \\',
    description: "Testing HTML escaping, symbols & emojis: & < > \" ' 🚀",
    tone: "dark",
  },
  decorators: [DarkBackground],
};

/** Adverse input condition: passing unsupported tone gracefully defaults to dark tone */
export const InvalidToneFallback: Story = {
  args: {
    title: "Invalid Tone Fallback",
    description:
      "Verifies safe fallback to dark tone styles when consumer supplies unsupported tone string.",
    // @ts-expect-error Testing adverse input boundary
    tone: "unsupported-tone-variant",
  },
  decorators: [DarkBackground],
};

/** Empty description boundary: whitespace-only string should omit paragraph and aria-describedby */
export const EmptyDescription: Story = {
  args: {
    title: "Empty Description Boundary",
    description: "   ",
    tone: "light",
  },
  decorators: [LightBackground],
};

/** Section heading boundary: H2 tag with explicit custom ID */
export const SubHeadingWithCustomId: Story = {
  args: {
    title: "Custom Section",
    description: "Rendered as an H2 heading with explicit custom id override.",
    as: "h2",
    id: "custom-section-heading-id",
    tone: "light",
  },
  decorators: [LightBackground],
};

/** Multi-action layout: multiple buttons in actions slot */
export const MultipleActions: Story = {
  args: {
    title: "Liquidity Pools",
    description: "Manage multiple pool allocations and harvest rewards.",
    tone: "dark",
    actions: (
      <>
        <button
          type="button"
          className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Filter Pools
        </button>
        <button
          type="button"
          className="rounded-lg border border-[#71B48D] bg-[#15A350] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add Liquidity
        </button>
      </>
    ),
  },
  decorators: [DarkBackground],
};

// ---------------------------------------------------------------------------
// Interactive Action Workflow (Failure, Retry, Recovery)
// ---------------------------------------------------------------------------

function InteractiveActionHarness() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [attempt, setAttempt] = useState(0);

  const handleSync = async () => {
    setStatus("loading");
    // Simulate async network latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (attempt === 0) {
      setAttempt(1);
      setStatus("error");
    } else {
      setStatus("success");
    }
  };

  return (
    <PageHeader
      title="Network Liquidity Sync"
      description="Synchronize pool reserves across active Stellar horizon nodes."
      tone="dark"
      actions={
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {status === "error" && (
            <span role="alert" className="text-xs text-red-300 font-medium">
              Sync failed. Retry required.
            </span>
          )}
          {status === "success" && (
            <span
              role="status"
              className="text-xs text-emerald-300 font-medium"
            >
              Reserves synced successfully!
            </span>
          )}
          <button
            type="button"
            disabled={status === "loading"}
            onClick={handleSync}
            className="rounded-lg border border-[#71B48D] bg-[#15A350] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading"
              ? "Syncing..."
              : status === "error"
                ? "Retry Sync"
                : status === "success"
                  ? "Resync"
                  : "Sync Reserves"}
          </button>
        </div>
      }
    />
  );
}

export const InteractiveActionWithFailureAndRetry: Story = {
  render: () => <InteractiveActionHarness />,
  decorators: [DarkBackground],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const syncButton = canvas.getByRole("button", { name: /sync reserves/i });
    expect(syncButton).toBeInTheDocument();

    // First attempt triggers simulated failure
    await userEvent.click(syncButton);
    const errorAlert = await canvas.findByRole("alert");
    expect(errorAlert).toHaveTextContent("Sync failed. Retry required.");

    // Retry attempt succeeds
    const retryButton = canvas.getByRole("button", { name: /retry sync/i });
    await userEvent.click(retryButton);
    const successStatus = await canvas.findByRole("status");
    expect(successStatus).toHaveTextContent("Reserves synced successfully!");
  },
};
