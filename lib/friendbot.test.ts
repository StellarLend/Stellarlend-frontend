import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fundWithFriendbot, pollUntilFunded } from "./friendbot";
import { config } from "./config";

describe("fundWithFriendbot", () => {
  const originalNetwork = config.network;
  const mockAddress = "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4";

  beforeEach(() => {
    config.network = "testnet";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    config.network = originalNetwork;
  });

  it("guards against non-testnet execution", async () => {
    config.network = "mainnet";
    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(false);
    expect(res.status).toBe("error");
    expect(res.message).toContain("testnet");
  });

  it("rejects empty or invalid address", async () => {
    const res = await fundWithFriendbot("");
    expect(res.ok).toBe(false);
    expect(res.status).toBe("error");
  });

  it("handles successful funding response (200 OK)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "ok" }),
    } as unknown as Response);

    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(true);
    expect(res.status).toBe("success");
    expect(global.fetch).toHaveBeenCalledWith(
      `https://friendbot.stellar.org?addr=${mockAddress}`,
      expect.any(Object)
    );
  });

  it("handles 400 op_already_exists as success with already_funded status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"detail": "op_already_exists"}',
    } as unknown as Response);

    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(true);
    expect(res.status).toBe("already_funded");
  });

  it("handles 400 createAccountAlreadyExist as success with already_funded status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"title": "createAccountAlreadyExist"}',
    } as unknown as Response);

    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(true);
    expect(res.status).toBe("already_funded");
  });

  it("handles 400 with other errors as failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"detail": "invalid address"}',
    } as unknown as Response);

    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(false);
    expect(res.status).toBe("error");
    expect(res.message).toContain("invalid address");
  });

  it("handles 5xx server errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as unknown as Response);

    const res = await fundWithFriendbot(mockAddress);
    expect(res.ok).toBe(false);
    expect(res.status).toBe("error");
    expect(res.message).toContain("503");
  });

  it("handles timeout error", async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const res = await fundWithFriendbot(mockAddress, { timeoutMs: 50 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("error");
    expect(res.message).toContain("timed out");
  });
});

describe("pollUntilFunded", () => {
  const mockAddress = "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4";

  it("returns true when account exists with native balance", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "10000.0000000" }],
      }),
    } as unknown as Response);

    const funded = await pollUntilFunded(mockAddress, { maxWaitMs: 1000, intervalMs: 50 });
    expect(funded).toBe(true);
  });

  it("polls multiple times if initially 404 then succeeds", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          balances: [{ asset_type: "native", balance: "10000.0000000" }],
        }),
      } as Response);
    });

    const funded = await pollUntilFunded(mockAddress, { maxWaitMs: 1000, intervalMs: 20 });
    expect(funded).toBe(true);
    expect(callCount).toBe(3);
  });

  it("returns false if abort signal is triggered", async () => {
    const controller = new AbortController();
    controller.abort();

    const funded = await pollUntilFunded(mockAddress, {
      maxWaitMs: 1000,
      intervalMs: 50,
      signal: controller.signal,
    });
    expect(funded).toBe(false);
  });
});
