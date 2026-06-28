// @vitest-environment jsdom

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import SessionExpiryModal from "./SessionExpiryModal";

// Stub next/navigation. The modal uses router.replace as an SSR fallback.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Stub the presentational dialog to observe container-level wiring without
// coupling tests to the dialog's internal focus-trap implementation.
vi.mock("./SessionExpiryDialog", () => ({
  default: ({
    isOpen,
    onStayLoggedIn,
    onLogOut,
  }: {
    isOpen: boolean;
    onStayLoggedIn: () => void;
    onLogOut: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" aria-label="session-expiry">
        <button onClick={onStayLoggedIn}>Stay Logged In</button>
        <button onClick={onLogOut}>Log Out</button>
      </div>
    ) : null,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ONE_MIN_FROM_NOW = () =>
  new Date(Date.now() + 60_000).toISOString();
const TWO_MIN_FROM_NOW = () =>
  new Date(Date.now() + 2 * 60_000).toISOString();
const TEN_MIN_FROM_NOW = () =>
  new Date(Date.now() + 10 * 60_000).toISOString();

describe("SessionExpiryModal", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    document.cookie = "csrf-token=test-csrf-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    document.cookie = "csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    vi.restoreAllMocks();
  });

  // Drive fake timers + the React microtask boundary together so async
  // effects (refresh, logout) flush before assertions read state.
  async function flushAsync(timerMs = 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(timerMs);
    });
  }

  it("does not open a modal when there is no active session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "No active session" }, 401));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SessionExpiryModal />);
    await flushAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open a modal when the session is far from expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: TEN_MIN_FROM_NOW(),
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SessionExpiryModal warningMinutes={5} />);
    await flushAsync(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await flushAsync(120_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a modal at expiry minus the warning window with no duplicate modals", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: ONE_MIN_FROM_NOW(),
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SessionExpiryModal warningMinutes={5} />);

    await flushAsync(0);
    await flushAsync(10);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await flushAsync(120_000);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("calls /api/auth/refresh with the CSRF cookie when 'Stay Logged In' is clicked", async () => {
    const refreshMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          success: true,
          session: {
            active: true,
            cookie: "session",
            expiresAt: TEN_MIN_FROM_NOW(),
          },
        }),
      );
    const sessionMock = vi.fn().mockImplementation(async () =>
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: ONE_MIN_FROM_NOW(),
        },
      }),
    );

    global.fetch = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/refresh")) return refreshMock(url, init);
        return sessionMock(url, init);
      }) as unknown as typeof fetch;

    render(<SessionExpiryModal warningMinutes={5} />);

    await flushAsync(0);
    await flushAsync(10);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click inside `act` and then advance timers + microtasks so the async
    // fetch + handleStayLoggedIn follow-up both resolve before we assert.
    await act(async () => {
      screen.getByRole("button", { name: /stay logged in/i }).click();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(refreshMock).toHaveBeenCalled();
    const refreshCall = refreshMock.mock.calls[0];
    expect(refreshCall[0]).toBe("/api/auth/refresh");
    const init: RequestInit | undefined = refreshCall[1];
    expect(init?.method).toBe("POST");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-csrf-token"]).toBe("test-csrf-token");
    expect(init?.credentials).toBe("same-origin");
  });

  it("keeps the modal open when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) => {
        if (String(url).includes("/refresh")) {
          return jsonResponse({ error: "boom" }, 500);
        }
        return jsonResponse({
          session: {
            active: true,
            cookie: "session",
            expiresAt: ONE_MIN_FROM_NOW(),
          },
        });
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SessionExpiryModal warningMinutes={5} />);

    await flushAsync(0);
    await flushAsync(10);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: /stay logged in/i }).click();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("session-announcer")).toHaveTextContent(
      /refresh/i,
    );
  });

  it("calls /api/auth/logout, sends CSRF, and closes the modal on Sign out", async () => {
    const logoutMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true }));
    const sessionMock = vi.fn().mockResolvedValue(
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: TWO_MIN_FROM_NOW(),
        },
      }),
    );

    global.fetch = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/logout")) return logoutMock(url, init);
        return sessionMock(url, init);
      }) as unknown as typeof fetch;

    // Note: jsdom (>= 26) marks `window.location.assign` as non-configurable
    // (TypeError: Cannot redefine property: assign), so redirect spying is
    // impossible here. We verify the logout path through the POST call +
    // modal-close + cleanup; redirect coverage backstops via the
    // session/logout route test.
    render(
      <SessionExpiryModal
        warningMinutes={5}
        postLogoutRedirect="/signed-out"
      />,
    );

    await flushAsync(0);
    await flushAsync(10);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: /log out/i }).click();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(logoutMock).toHaveBeenCalled();
    const logoutCall = logoutMock.mock.calls[0];
    expect(logoutCall[0]).toBe("/api/auth/logout");
    const init: RequestInit | undefined = logoutCall[1];
    expect(init?.method).toBe("POST");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-csrf-token"]).toBe("test-csrf-token");

    // The modal must close after a successful logout.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // And the announcer must reflect the signed-out state.
    expect(screen.getByTestId("session-announcer")).toHaveTextContent(
      /sign/i,
    );
  });

  it("clears timers and aborts in-flight requests on unmount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: ONE_MIN_FROM_NOW(),
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { unmount } = render(<SessionExpiryModal warningMinutes={5} />);

    await flushAsync(0);

    const fetchCallsBefore = fetchMock.mock.calls.length;

    unmount();

    await flushAsync(120_000);

    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
  });

  it("polls the session endpoint on a fixed interval", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        session: {
          active: true,
          cookie: "session",
          expiresAt: TEN_MIN_FROM_NOW(),
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SessionExpiryModal pollIntervalMs={30_000} />);

    await flushAsync(0);

    const initialCalls = fetchMock.mock.calls.length;

    await flushAsync(90_000);

    // At least two additional polls expected within the 90s window
    // (poll at 30s and 60s).
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(
      initialCalls + 2,
    );
  });
});
