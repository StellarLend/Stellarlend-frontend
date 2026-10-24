import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmountInput } from "../amount-input";

describe("AmountInput component", () => {
  it("renders with visible label correctly associated with input", () => {
    render(<AmountInput id="test-amount" label="Deposit Amount" />);
    const label = screen.getByText("Deposit Amount");
    const input = screen.getByLabelText("Deposit Amount");
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("for", "test-amount");
    expect(input).toHaveAttribute("id", "test-amount");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("renders symbol affix when provided", () => {
    render(<AmountInput symbol="XLM" placeholder="0.0" />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("renders Max button and calls onMax callback", () => {
    const onMax = vi.fn();
    render(<AmountInput onMax={onMax} max="100.5" />);
    const maxButton = screen.getByRole("button", { name: "Max (100.5)" });
    expect(maxButton).toBeInTheDocument();
    fireEvent.click(maxButton);
    expect(onMax).toHaveBeenCalledTimes(1);
  });

  it("wires error slot with aria-describedby and aria-invalid", () => {
    render(<AmountInput id="error-input" error="Amount exceeds balance" />);
    const input = screen.getByRole("textbox");
    const errorMsg = screen.getByRole("alert");

    expect(errorMsg).toHaveTextContent("Amount exceeds balance");
    expect(errorMsg).toHaveAttribute("id", "error-input-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "error-input-error");
  });

  it("respects decimals prop and rejects values with more decimal places", () => {
    const onChange = vi.fn();
    render(<AmountInput decimals={2} onChange={onChange} />);
    const input = screen.getByRole("textbox");

    // 2 decimals allowed
    fireEvent.change(input, { target: { value: "12.34" } });
    expect(onChange).toHaveBeenCalledTimes(1);

    // 3 decimals blocked
    fireEvent.change(input, { target: { value: "12.345" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onValueChange with updated value", () => {
    const onValueChange = vi.fn();
    render(<AmountInput onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "50" } });
    expect(onValueChange).toHaveBeenCalledWith("50");
  });
});
