import React from 'react';
import { render, screen, fireEvent } from "@/test/test-utils";
import { AmountInput } from "./AmountInput";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("AmountInput Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    
    // Typing "1234.56"
    fireEvent.change(input, { target: { value: "1,234.56" } });
    vi.runAllTimers();
    
    expect(onChange).toHaveBeenCalledWith(1234.56);
  });

  it("handles precision correctly", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} precision={4} />);
    
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.23456" } });
    vi.runAllTimers();
    
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
    
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    expect(input.value).toBe("1,234,567.89");
  });

  it("handles thousands grouping while typing", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234" } });
    vi.runAllTimers();
    expect(input.value).toBe("1,234");
    expect(onChange).toHaveBeenCalledWith(1234);
  });

  it("handles paste of formatted number", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,234,567.89" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(1234567.89);
    expect(input.value).toBe("1,234,567.89");
  });

  it("normalises leading zeros", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "00012.34" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(12.34);
    expect(input.value).toBe("12.34");
  });

  it("rejects non-numeric characters", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(123);
    expect(input.value).toBe("123");
  });

  it("rejects multiple decimal points", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.2.3" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(1.23);
    expect(input.value).toBe("1.23");
  });

  it("handles empty input", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={10} onChange={onChange} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(0);
    expect(input.value).toBe("");
  });

  it("clamps to max prop", () => {
    const onChange = vi.fn();
    render(<AmountInput label="Amount" value={0} onChange={onChange} max={1000} />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2,000" } });
    vi.runAllTimers();
    expect(onChange).toHaveBeenCalledWith(1000);
    expect(input.value).toBe("1,000");
  });
});
