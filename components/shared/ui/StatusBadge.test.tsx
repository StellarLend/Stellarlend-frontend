import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";
import {
  StatusBadge,
  transactionStatusToVariant,
} from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the success variant with default label and exposes a status role", () => {
    render(<StatusBadge variant="success" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Completed");
    expect(badge).toHaveAttribute("aria-label", "Status: success: Completed");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("renders the pending variant with default label", () => {
    render(<StatusBadge variant="pending" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Processing");
    expect(badge).toHaveAttribute("aria-label", "Status: pending: Processing");
  });

  it("renders the failed variant with default label", () => {
    render(<StatusBadge variant="failed" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Failed");
    expect(badge).toHaveAttribute("aria-label", "Status: failed: Failed");
  });

  it("renders the neutral variant with default label", () => {
    render(<StatusBadge variant="neutral" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Unknown");
  });

  it("renders a custom label when provided and reflects it in the aria-label", () => {
    render(<StatusBadge variant="pending" label="Awaiting confirmation" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Awaiting confirmation");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Status: pending: Awaiting confirmation"
    );
  });

  it("does not rely on color alone — always renders an icon next to the label", () => {
    const { container } = render(<StatusBadge variant="success" />);
    const badge = screen.getByRole("status");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(badge).toContainElement(icon as unknown as HTMLElement);
  });

  it("hides the icon from assistive technology so the label is announced once", () => {
    const { container } = render(<StatusBadge variant="failed" />);
    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).not.toBeNull();
    const innerIcon = iconWrapper?.querySelector("svg");
    expect(innerIcon).not.toBeNull();
  });

  it("accepts a custom icon override", () => {
    render(
      <StatusBadge
        variant="neutral"
        icon={<span data-testid="custom-icon">!</span>}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("supports md size with larger padding/typography classes", () => {
    render(<StatusBadge variant="success" size="md" />);
    expect(screen.getByRole("status").className).toMatch(/text-sm/);
  });

  it("merges consumer className without dropping built-in classes", () => {
    render(<StatusBadge variant="success" className="custom-cls" />);
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("custom-cls");
    expect(badge.className).toMatch(/rounded-full/);
  });
});

describe("transactionStatusToVariant", () => {
  it.each([
    ["Completed", "success"],
    ["completed", "success"],
    ["Success", "success"],
    ["Processing", "pending"],
    ["pending", "pending"],
    ["Failed", "failed"],
    ["error", "failed"],
  ])("maps %s -> %s", (input, expected) => {
    expect(transactionStatusToVariant(input)).toBe(expected);
  });

  it("falls back to neutral for unknown statuses", () => {
    expect(transactionStatusToVariant("WeirdStatus")).toBe("neutral");
  });
});
