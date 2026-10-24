import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthChip } from "./health-chip";
import {
  DEFAULT_THRESHOLDS,
  HEALTH_FACTOR_NO_DEBT,
  I128_MAX,
  classifyHealth,
  decodeHealthFactor,
} from "@/lib/health";
import type { MonitorStatus } from "@/hooks/use-health-monitor";

function renderChip(raw: bigint | null, status: MonitorStatus = "ok") {
  const health = raw === null ? null : decodeHealthFactor(raw);
  const level = health ? classifyHealth(health, DEFAULT_THRESHOLDS) : null;
  render(
    <HealthChip
      health={health}
      level={level}
      status={status}
      thresholds={DEFAULT_THRESHOLDS}
      onSaveThresholds={() => null}
      notifications={{
        permission: "default",
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      }}
    />,
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