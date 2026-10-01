import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";

import Button, { ButtonProps } from "./Button";

/**
 * Button Component Stories
 *
 * Includes failure-path and boundary coverage to ensure deterministic behavior.
 * This covers normal operation, invalid/boundary input, loading (concurrency/retries),
 * and failure recovery scenarios.
 */
const meta: Meta<typeof Button> = {
  title: "Components/Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "destructive", "danger", "success", "outline"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    fullWidth: { control: "boolean" },
    onClick: { action: "clicked" },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Click me",
    variant: "primary",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /click me/i });
    await expect(button).toBeInTheDocument();
    await expect(button).not.toBeDisabled();
    
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Secondary: Story = {
  args: {
    children: "Cancel",
    variant: "secondary",
  },
};

export const LoadingState: Story = {
  args: {
    children: "Submitting",
    isLoading: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    
    // Assert button is disabled when loading to prevent concurrent submissions
    await expect(button).toBeDisabled();
    
    // Assert spinner is present (SVG)
    const spinner = canvasElement.querySelector("svg");
    await expect(spinner).toBeInTheDocument();
    
    // Clicking should not trigger onClick since it is disabled
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const DisabledBoundary: Story = {
  args: {
    children: "Not Allowed",
    disabled: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const VeryLongTextBoundary: Story = {
  args: {
    children: "This is an extremely long button text that might overflow or wrap unexpectedly if not handled properly in the boundary conditions of the component.",
    variant: "primary",
  },
};

export const EmptyTextBoundary: Story = {
  args: {
    children: "",
    variant: "primary",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await expect(button).toBeInTheDocument();
    // It should render even without text without crashing
  },
};

const InteractiveButtonWithState = (props: ButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      setLoading(true);
      setError(null);
      // Simulate network request
      await new Promise((_, reject) => setTimeout(() => reject(new Error("Network failure")), 500));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    if (props.onClick) props.onClick(e);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button {...props} isLoading={loading} onClick={handleClick} />
      {error && <span role="alert" className="text-red-500 text-sm">{error}</span>}
    </div>
  );
};

export const RetryAndFailurePath: Story = {
  render: (args) => <InteractiveButtonWithState {...args} />,
  args: {
    children: "Save Data",
    variant: "primary",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /save data/i });
    
    // Initial state
    await expect(button).not.toBeDisabled();
    
    // Trigger action
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
    
    // Assert loading state prevents double click
    await expect(button).toBeDisabled();
    
    // Wait for failure
    const errorAlert = await canvas.findByRole("alert");
    await expect(errorAlert).toHaveTextContent("Network failure");
    
    // Verify recovery: button is enabled again for retry
    await expect(button).not.toBeDisabled();
    
    // Retry action
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
