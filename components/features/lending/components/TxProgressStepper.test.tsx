import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import TxProgressStepper, { type TxProgressState } from "./TxProgressStepper";

function getStep(id: TxProgressState): HTMLElement {
  const step = document.querySelector<HTMLElement>(`[data-step="${id}"]`);
  if (!step) {
    throw new Error(`Missing ${id} step`);
  }
  return step;
}

describe("TxProgressStepper", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("drives the visual steps through the transaction lifecycle", () => {
    const { rerender } = render(<TxProgressStepper state="building" />);

    expect(getStep("building")).toHaveAttribute("data-state", "current");
    expect(getStep("submitted")).toHaveAttribute("data-state", "upcoming");

    rerender(<TxProgressStepper state="submitted" />);
    expect(getStep("building")).toHaveAttribute("data-state", "complete");
    expect(getStep("submitted")).toHaveAttribute("data-state", "current");

    rerender(<TxProgressStepper state="pending" />);
    expect(getStep("submitted")).toHaveAttribute("data-state", "complete");
    expect(getStep("pending")).toHaveAttribute("data-state", "current");

    rerender(<TxProgressStepper state="confirmed" />);
    expect(getStep("pending")).toHaveAttribute("data-state", "complete");
    expect(getStep("confirmed")).toHaveAttribute("data-state", "current");
  });

  it("renders the failed terminal state", () => {
    render(<TxProgressStepper state="failed" />);

    expect(getStep("pending")).toHaveAttribute("data-state", "complete");
    expect(getStep("failed")).toHaveAttribute("data-state", "current");
    expect(getStep("failed")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("status")).toHaveTextContent("Transaction failed.");
  });

  it("supports an immediate confirmation without intermediate renders", () => {
    render(<TxProgressStepper state="confirmed" />);

    expect(getStep("building")).toHaveAttribute("data-state", "complete");
    expect(getStep("submitted")).toHaveAttribute("data-state", "complete");
    expect(getStep("pending")).toHaveAttribute("data-state", "complete");
    expect(getStep("confirmed")).toHaveAttribute("data-state", "current");
  });

  it.each<[TxProgressState, string]>([
    ["building", "Building transaction."],
    ["submitted", "Transaction submitted to the network."],
    ["pending", "Transaction pending on-chain."],
    ["confirmed", "Transaction confirmed on-chain."],
    ["failed", "Transaction failed."],
  ])("announces the %s state accessibly", (state, announcement) => {
    render(<TxProgressStepper state={state} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent(announcement);
  });

  it("does not poll and unmounts without leaving component side effects", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<TxProgressStepper state="pending" />);
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
