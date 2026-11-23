import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { HealthChip } from "./health-chip";
import {
  DEFAULT_THRESHOLDS,
  HEALTH_FACTOR_NO_DEBT,
  I128_MAX,
  classifyHealth,
  decodeHealthFactor,
  validateThresholds,
} from "@/lib/health";
import type {
  MonitorStatus,
  NotificationPermissionState,
} from "@/hooks/use-health-monitor";

function renderChip(
  raw: bigint | null,
  status: MonitorStatus = "ok",
  options?: {
    onSaveThresholds?: (next: { warning: number; danger: number }) => string | null;
    permission?: NotificationPermissionState;
    enabled?: boolean;
    enable?: () => void;
    disable?: () => void;
  },
) {
  const health = raw === null ? null : decodeHealthFactor(raw);
  const level = health ? classifyHealth(health, DEFAULT_THRESHOLDS) : null;
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HealthChip
        health={health}
        level={level}
        status={status}
        thresholds={DEFAULT_THRESHOLDS}
        onSaveThresholds={options?.onSaveThresholds ?? (() => null)}
        notifications={{
          permission: options?.permission ?? "default",
          enabled: options?.enabled ?? false,
          enable: options?.enable ?? vi.fn(),
          disable: options?.disable ?? vi.fn(),
        }}
      />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("health-chip");
}

describe("HealthChip", () => {
  it("shows HF to 2 decimals and the safe level", () => {
    const chip = renderChip(BigInt(20000));
    expect(chip.textContent).toContain("2.00");
    expect(chip.textContent).toContain("Safe");
    expect(chip.getAttribute("data-level")).toBe("safe");
  });

  it("shows warning, danger and liquidatable levels", () => {
    expect(renderChip(BigInt(14000)).textContent).toContain("Warning");
  });

  it("shows danger", () => {
    expect(renderChip(BigInt(11000)).textContent).toContain("Danger");
  });

  it("shows liquidatable and truncates below 1.00", () => {
    const chip = renderChip(BigInt(9999));
    expect(chip.textContent).toContain("0.99");
    expect(chip.textContent).toContain("Liquidatable");
  });

  it("renders the no-debt sentinel as No debt", () => {
    expect(renderChip(HEALTH_FACTOR_NO_DEBT).textContent).toBe("No debt");
  });

  it("renders the i128::MAX overflow as Very safe, not a number", () => {
    expect(renderChip(I128_MAX).textContent).toBe("Very safe");
  });

  it("shows loading and error states", () => {
    expect(renderChip(null, "loading").textContent).toContain("loading");
  });

  it("shows unavailable on error", () => {
    expect(renderChip(null, "error").textContent).toContain("unavailable");
  });

  it("links to Markets", () => {
    expect(renderChip(BigInt(20000)).getAttribute("href")).toBe("/markets");
  });
});

describe("HealthSettings popover", () => {
  it("opens on click, closes on Escape, and returns focus to trigger", () => {
    renderChip(BigInt(20000));
    const trigger = screen.getByRole("button", { name: "Health alert settings" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Health alert settings" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("rejects danger >= warning with the validateThresholds message and does not save", () => {
    const onSave = vi.fn((next: { warning: number; danger: number }) =>
      validateThresholds(next),
    );
    renderChip(BigInt(20000), "ok", { onSaveThresholds: onSave });

    fireEvent.click(screen.getByRole("button", { name: "Health alert settings" }));
    fireEvent.change(screen.getByLabelText("Warning below"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByLabelText("Danger below"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save thresholds" }));

    expect(onSave).toHaveBeenCalledWith({ warning: 1.2, danger: 1.5 });
    const expectedError = validateThresholds({ warning: 1.2, danger: 1.5 });
    expect(expectedError).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent(expectedError!);
  });

  it("hides the notification toggle with an explanatory note when permission is unsupported", () => {
    renderChip(BigInt(20000), "ok", { permission: "unsupported" });

    fireEvent.click(screen.getByRole("button", { name: "Health alert settings" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText("Browser notifications are not supported here."),
    ).toBeInTheDocument();
  });

  it("requests permission / toggles notifications when supported", () => {
    const enable = vi.fn();
    renderChip(BigInt(20000), "ok", { permission: "default", enabled: false, enable });

    fireEvent.click(screen.getByRole("button", { name: "Health alert settings" }));
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(enable).toHaveBeenCalledTimes(1);
  });
});
