// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { getRpcServer, pollTransactionStatus } from "./rpc-tx";

describe("lib/rpc-tx", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses object options and polls until the transaction succeeds", async () => {
    vi.useFakeTimers();
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.NOT_FOUND,
      })
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        ledger: 123,
      });
    const server = { getTransaction } as unknown as rpc.Server;

    const result = pollTransactionStatus("tx-hash", {
      server,
      timeoutMs: 2_000,
      intervalMs: 250,
    });
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toMatchObject({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      ledger: 123,
    });
    expect(getTransaction).toHaveBeenNthCalledWith(1, "tx-hash");
    expect(getTransaction).toHaveBeenNthCalledWith(2, "tx-hash");
  });

  it("passes failed transaction details through parseError", async () => {
    const parseError = vi.fn((message: string) => `parsed: ${message}`);
    const server = {
      getTransaction: vi.fn().mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
        resultXdr: {
          toXDR: (format: string) =>
            format === "base64" ? "encoded-contract-error" : "",
        },
      }),
    } as unknown as rpc.Server;

    await expect(
      pollTransactionStatus("tx-failed", { server, parseError }),
    ).rejects.toThrow(
      "Transaction failed on-chain: parsed: encoded-contract-error",
    );
    expect(parseError).toHaveBeenCalledWith("encoded-contract-error");
  });

  it("times out while the transaction remains unavailable", async () => {
    vi.useFakeTimers();
    const getTransaction = vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.NOT_FOUND,
    });
    const server = { getTransaction } as unknown as rpc.Server;
    const polling = pollTransactionStatus("tx-timeout", {
      server,
      timeoutMs: 250,
      intervalMs: 100,
    });
    const rejection = expect(polling).rejects.toThrow(
      "Transaction timed out while waiting for confirmation: tx-timeout",
    );

    await vi.advanceTimersByTimeAsync(300);
    await rejection;
    expect(getTransaction).toHaveBeenCalledTimes(3);
  });

  it("aborts while waiting between polls", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const getTransaction = vi.fn().mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.NOT_FOUND,
    });
    const server = { getTransaction } as unknown as rpc.Server;
    const polling = pollTransactionStatus("tx-abort", {
      server,
      timeoutMs: 2_000,
      intervalMs: 500,
      signal: controller.signal,
    });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort(new Error("caller cancelled"));

    await expect(polling).rejects.toThrow("caller cancelled");
    expect(getTransaction).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight RPC request", async () => {
    const controller = new AbortController();
    const getTransaction = vi.fn(
      () => new Promise<never>(() => {}),
    );
    const server = { getTransaction } as unknown as rpc.Server;
    const polling = pollTransactionStatus("tx-abort-request", {
      server,
      signal: controller.signal,
    });

    await Promise.resolve();
    controller.abort(new Error("request cancelled"));

    await expect(polling).rejects.toThrow("request cancelled");
    expect(getTransaction).toHaveBeenCalledWith("tx-abort-request");
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled before polling"));
    const getTransaction = vi.fn();
    const server = { getTransaction } as unknown as rpc.Server;

    await expect(
      pollTransactionStatus("tx-pre-aborted", {
        server,
        signal: controller.signal,
      }),
    ).rejects.toThrow("cancelled before polling");
    expect(getTransaction).not.toHaveBeenCalled();
  });

  it("returns a supplied RPC server without replacing it", () => {
    const server = {} as rpc.Server;
    expect(getRpcServer(server)).toBe(server);
  });

  it("creates an RPC server for the supplied URL without making a request", () => {
    const server = getRpcServer(undefined, "https://rpc.example.org");
    expect(server).toBeInstanceOf(rpc.Server);
    expect(server.serverURL.toString()).toBe("https://rpc.example.org/");
  });
});
