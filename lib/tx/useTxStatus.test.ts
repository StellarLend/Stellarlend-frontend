// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useTxStatus from "./useTxStatus";
import {
  TX_API_STATUS,
  TX_HOOK_STATE,
  TX_STATUS_ENDPOINT,
  TX_STATUS_POLL,
} from "./constants";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function createFetchMock(
  handlers: Array<
    Response | Error | ((callIndex: number) => Response | Promise<Response>)
  >,
) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const handler = handlers[Math.min(callIndex, handlers.length - 1)];
    callIndex += 1;
    if (handler instanceof Error) return Promise.reject(handler);
    if (handler instanceof Response) return Promise.resolve(handler);
    return Promise.resolve(handler(callIndex));
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advanceAndFlush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useTxStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not fetch when hash is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useTxStatus(null));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets processing then completed when API returns SUCCESS immediately", async () => {
    const payload = { status: TX_API_STATUS.SUCCESS, hash: "abc" };
    const fetchMock = createFetchMock([jsonResponse(payload)]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    expect(result.current).toEqual({ state: TX_HOOK_STATE.PROCESSING });
    await flushUpdates();
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.COMPLETED,
      result: payload,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      TX_STATUS_ENDPOINT("abc"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("polls with backoff from pending to success", async () => {
    const successPayload = { status: TX_API_STATUS.SUCCESS, hash: "abc" };
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
      jsonResponse(successPayload),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current?.state).toBe(TX_HOOK_STATE.PROCESSING);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.COMPLETED,
      result: successPayload,
    });

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doubles poll delay between consecutive pending responses", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
      jsonResponse({ status: TX_API_STATUS.PENDING }),
      jsonResponse({ status: TX_API_STATUS.SUCCESS, hash: "abc" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondDelay =
      TX_STATUS_POLL.INITIAL_DELAY_MS * TX_STATUS_POLL.BACKOFF_MULTIPLIER;
    await advanceAndFlush(secondDelay - 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await advanceAndFlush(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops polling and returns failed when API returns FAILED", async () => {
    const failurePayload = { status: TX_API_STATUS.FAILED, hash: "abc" };
    const fetchMock = createFetchMock([jsonResponse(failurePayload)]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.FAILED,
      error: failurePayload,
    });

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops polling and returns failed when API returns NOT_FOUND", async () => {
    const notFoundPayload = { status: TX_API_STATUS.NOT_FOUND, hash: "missing" };
    const fetchMock = createFetchMock([jsonResponse(notFoundPayload)]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("missing"));

    await flushUpdates();
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.FAILED,
      error: notFoundPayload,
    });

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("transitions from pending to failed without further polling", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
      jsonResponse({ status: TX_API_STATUS.FAILED, hash: "abc" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS);
    expect(result.current?.state).toBe(TX_HOOK_STATE.FAILED);

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops and returns rate_limited on 429 with Retry-After", async () => {
    const fetchMock = createFetchMock([
      new Response("rate", { status: 429, headers: { "Retry-After": "5" } }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("rate-limited"));

    await flushUpdates();
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.RATE_LIMITED,
      retryAfterSeconds: 5,
    });

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns rate_limited without retryAfterSeconds when header is absent", async () => {
    const fetchMock = createFetchMock([new Response("rate", { status: 429 })]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("rate-limited"));

    await flushUpdates();
    expect(result.current).toEqual({ state: TX_HOOK_STATE.RATE_LIMITED });
  });

  it("retries after transient fetch error then completes", async () => {
    const successPayload = { status: TX_API_STATUS.SUCCESS, hash: "abc" };
    const fetchMock = createFetchMock([
      new Error("network"),
      jsonResponse(successPayload),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS);
    expect(result.current).toEqual({
      state: TX_HOOK_STATE.COMPLETED,
      result: successPayload,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("applies exponential backoff after consecutive fetch errors", async () => {
    const fetchMock = createFetchMock([
      new Error("network-1"),
      new Error("network-2"),
      jsonResponse({ status: TX_API_STATUS.SUCCESS, hash: "abc" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondDelay =
      TX_STATUS_POLL.INITIAL_DELAY_MS * TX_STATUS_POLL.BACKOFF_MULTIPLIER;
    await advanceAndFlush(secondDelay);
    expect(result.current?.state).toBe(TX_HOOK_STATE.COMPLETED);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops polling on unmount and does not fetch again", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts a new poll when hash changes", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
      jsonResponse({ status: TX_API_STATUS.SUCCESS, hash: "new" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(({ hash }) => useTxStatus(hash), {
      initialProps: { hash: "old" as string | null },
    });

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      TX_STATUS_ENDPOINT("old"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    rerender({ hash: "new" });
    await flushUpdates();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      TX_STATUS_ENDPOINT("new"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("clears polling when hash is set to null", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ status: TX_API_STATUS.PENDING }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(({ hash }) => useTxStatus(hash), {
      initialProps: { hash: "abc" as string | null },
    });

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ hash: null });
    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores abort errors when polling is cancelled", async () => {
    let rejectFetch: (reason: Error) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
          rejectFetch = reject;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    rejectFetch(Object.assign(new Error("aborted"), { name: "AbortError" }));

    await advanceAndFlush(TX_STATUS_POLL.MAX_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats missing status as pending and continues polling", async () => {
    const fetchMock = createFetchMock([
      jsonResponse({ hash: "abc" }),
      jsonResponse({ status: TX_API_STATUS.SUCCESS, hash: "abc" }),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTxStatus("abc"));

    await flushUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advanceAndFlush(TX_STATUS_POLL.INITIAL_DELAY_MS);
    expect(result.current?.state).toBe(TX_HOOK_STATE.COMPLETED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
