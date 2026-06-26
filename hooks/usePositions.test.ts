import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePositions, mapPositionsResponse } from "./usePositions";

describe("mapPositionsResponse", () => {
  it("should return empty array if input is null or undefined", () => {
    expect(mapPositionsResponse(null)).toEqual([]);
    expect(mapPositionsResponse(undefined)).toEqual([]);
  });

  it("should parse flat object format with positive borrowedAmount", () => {
    const mockData = {
      borrowedAmount: "$1,500.00 XLM",
      healthFactor: 1.5,
      nextDue: "$250.00 in 4 days",
    };
    const result = mapPositionsResponse(mockData);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "borrow-XLM",
      asset: "XLM",
      amount: 1500,
      healthFactor: 1.5,
      nextDue: "$250.00 in 4 days",
    });
  });

  it("should ignore flat object format if borrowedAmount is 0", () => {
    const mockData = {
      borrowedAmount: "$0.00 XLM",
      healthFactor: 1.5,
    };
    const result = mapPositionsResponse(mockData);
    expect(result).toEqual([]);
  });

  it("should parse array format in positions property", () => {
    const mockData = {
      positions: [
        { type: "borrow", asset: "USDC", amount: 500, healthFactor: 2.1 },
        { type: "lend", asset: "XLM", amount: 2000 },
        { type: "borrow", asset: "BTC", amount: 0.05, nextDue: "due in 2 days" },
      ],
      healthFactor: 1.8,
    };
    const result = mapPositionsResponse(mockData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "borrow-USDC-0",
      asset: "USDC",
      amount: 500,
      healthFactor: 2.1,
      nextDue: undefined,
    });
    expect(result[1]).toEqual({
      id: "borrow-BTC-2",
      asset: "BTC",
      amount: 0.05,
      healthFactor: 1.8,
      nextDue: "due in 2 days",
    });
  });
});

describe("usePositions Hook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle loading state initially and then success", async () => {
    const mockResponse = {
      borrowedAmount: "$1,500.00 XLM",
      healthFactor: 1.5,
      nextDue: "$250.00 in 4 days",
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(() => usePositions());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.positions).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0]).toEqual({
      id: "borrow-XLM",
      asset: "XLM",
      amount: 1500,
      healthFactor: 1.5,
      nextDue: "$250.00 in 4 days",
    });
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch failure and call onError callback", async () => {
    const mockError = new Error("Network error");
    vi.mocked(global.fetch).mockRejectedValueOnce(mockError);
    const mockOnError = vi.fn();

    const { result } = renderHook(() => usePositions(mockOnError));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toEqual([]);
    expect(result.current.error).toEqual(mockError);
    expect(mockOnError).toHaveBeenCalledWith(mockError);
  });

  it("should return empty array for only-lend positions", async () => {
    const mockResponse = {
      borrowedAmount: "$0.00 XLM",
      suppliedFunds: "$5,000.00 XLM",
      healthFactor: 2.5,
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const { result } = renderHook(() => usePositions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
