import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";
import { UtilizationBar } from "./UtilizationBar";

describe("UtilizationBar", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("shows loading state initially", () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<UtilizationBar asset="XLM" />);
    expect(screen.getByTestId("utilization-loading-XLM")).toBeInTheDocument();
  });

  it("renders utilization bar with clamped values when 0", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ asset: "XLM", utilization: 0 }],
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("0.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar with clamped values when > 100", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ asset: "XLM", utilization: 150 }],
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });
  });

  it("renders utilization bar correctly for valid percentage", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ asset: "XLM", utilization: 45.6 }],
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByText("45.6%")).toBeInTheDocument();
    });
  });

  it("degrades gracefully when market entry is missing", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<UtilizationBar asset="XLM" />);

    await waitFor(() => {
      expect(screen.getByTestId("utilization-missing-XLM")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });
});
