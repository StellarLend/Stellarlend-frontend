import React from 'react';
import { render, screen, fireEvent } from "@/test/test-utils";
import { AmountInput } from "./AmountInput";
import { describe, it, expect, vi } from "vitest";

describe("AmountInput Component", () => {
  it("renders with label and placeholder", () => {
    render(<AmountInput label="Amount" value={0} onChange={() => {}} placeholder="0.00" />);
    
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<AmountInput label="Amount" value={0} onChange={() => {}} error="Invalid amount" />);
    
    expect(screen.getByText("Invalid amount")).toBeInTheDocument();
  });

  it("calls onChange with correct numeric value when input changes", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    
    const input = screen.getByLabelText("Amount");
    
    // Typing "1234.56"
    fireEvent.change(input, { target: { value: "1,234.56" } });
    
    expect(onChange).toHaveBeenCalledWith(1234.56);
  });

  it("handles precision correctly", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} precision={4} />);
    
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "1.23456" } });
    
    expect(onChange).toHaveBeenCalledWith(1.2345);
  });

  it("handles unit display", () => {
    render(<AmountInput label="Amount" value={0} onChange={() => {}} unit="XLM" />);
    
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("calls onMax when MAX button is clicked", () => {
    const onMax = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={() => {}} onMax={onMax} />);
    
    const maxButton = screen.getByText("MAX");
    fireEvent.click(maxButton);
    
    expect(onMax).toHaveBeenCalled();
  });

  it("formats value with commas on display", () => {
    render(<AmountInput label="Amount" value={1234567.89} onChange={() => {}} />);
    
    const input = screen.getByLabelText("Amount");
    expect(input.value).toBe("1,234,567.89");
  });
});
