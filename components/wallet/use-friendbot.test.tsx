/**
 * Focused tests for useFriendbot.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFriendbot } from "./use-friendbot";
import { config } from "@/lib/config";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/friendbot", () => ({
  fundWithFriendbot: vi.fn(),
  pollUntilFunded: vi.fn(),
}));

import { fundWithFriendbot, pollUntilFunded } from "@/lib/friendbot";

const TEST_ADDRESS = "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4";

describe("useFriendbot", () => {
  const originalNetwork = config.network;

  beforeEach(() => {
    vi.clearAllMocks();
    config.network = "testnet";
  });

  afterEach(() => {
    config.network = originalNetwork;
  });

  it("starts with isFunding false and no fundError", () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));
    expect(result.current.isFunding).toBe(false);
    expect(result.current.fundError).toBeNull();
  });

  it("does not fund when address is null", async () => {
    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(null, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(vi.mocked(fundWithFriendbot)).not.toHaveBeenCalled();
  });

  it("does not fund on mainnet", async () => {
    config.network = "mainnet";
    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(vi.mocked(fundWithFriendbot)).not.toHaveBeenCalled();
  });

  it("sets isFunding during the call and resets after success", async () => {
    vi.mocked(fundWithFriendbot).mockResolvedValue({ ok: true, status: "success", message: "" });
    vi.mocked(pollUntilFunded).mockResolvedValue(true);

    const invalidate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(result.current.isFunding).toBe(false);
    expect(result.current.fundError).toBeNull();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("sets fundError when Friendbot returns non-ok", async () => {
    vi.mocked(fundWithFriendbot).mockResolvedValue({ ok: false, status: "already_funded", message: "Account already funded" });
    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(result.current.fundError).toBe("Account already funded");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("sets fundError when poll times out", async () => {
    vi.mocked(fundWithFriendbot).mockResolvedValue({ ok: true, status: "success", message: "" });
    vi.mocked(pollUntilFunded).mockResolvedValue(false);

    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(result.current.fundError).toBe("fundTimeout");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("resetFundState clears fundError", async () => {
    vi.mocked(fundWithFriendbot).mockResolvedValue({ ok: false, status: "error", message: "Failed" });
    const invalidate = vi.fn();
    const { result } = renderHook(() => useFriendbot(TEST_ADDRESS, invalidate));

    await act(async () => {
      await result.current.fundAccount();
    });

    expect(result.current.fundError).toBe("Failed");

    act(() => {
      result.current.resetFundState();
    });

    expect(result.current.fundError).toBeNull();
    expect(result.current.isFunding).toBe(false);
  });
});
