import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, render, screen } from "@testing-library/react";
import { WalletProvider, useWalletContext } from "./WalletContext";
import { FC, ReactNode, createElement } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WalletProvider, null, children);
}

const TEST_ADDRESS = "GABCDEF1234567890";

function mockResponse(ok: boolean, body: any = {}, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function setupStellar() {
  (window as any).stellar = {
    getPublicKey: vi.fn().mockResolvedValue(TEST_ADDRESS),
    signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  (window as any).stellar = undefined;
});

function ConnectHarness() {
  const ctx = useWalletContext();
  return createElement("div", null,
    createElement("span", { "data-testid": "status" }, ctx.status),
    createElement("span", { "data-testid": "error" }, ctx.error || ""),
    createElement("span", { "data-testid": "address" }, ctx.address || ""),
    createElement("button", {
      "data-testid": "connect-btn",
      onClick: () => { ctx.connect(); },
    }, "Connect"),
    createElement("button", {
      "data-testid": "disconnect-btn",
      onClick: () => { ctx.disconnect(); },
    }, "Disconnect"),
  );
}

function renderApp() {
  return render(createElement(WalletProvider, null, createElement(ConnectHarness)));
}

describe("WalletProvider", () => {
  describe("initial state", () => {
    it("starts disconnected with null address", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("disconnected"));
      expect(result.current.address).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("derives network from config (testnet)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("disconnected"));
      expect(result.current.network).toBe("TESTNET");
    });
  });

  describe("rehydration", () => {
    it("restores from sessionStorage on mount", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBe(TEST_ADDRESS);
        expect(result.current.status).toBe("connected");
      });
    });

    it("restores from server session on mount", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse(true, {
          session: { user: { walletAddress: TEST_ADDRESS } },
        }),
      );

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBe(TEST_ADDRESS);
        expect(result.current.status).toBe("connected");
      });
    });

    it("prefers sessionStorage over server session", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse(true, {
          session: { user: { walletAddress: "GOTHERADDRESS" } },
        }),
      );

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBe(TEST_ADDRESS);
        expect(result.current.status).toBe("connected");
      });
    });

    it("clears state when server has no session", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse(true, { session: {} }),
      );

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.status).toBe("disconnected");
      });
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("clears state on server session fetch failure", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.status).toBe("disconnected");
      });
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("handles network error during rehydration gracefully", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.address).toBe(TEST_ADDRESS);
      });
    });
  });

  describe("connect", () => {
    it("transitions to connected on success", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar();
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
        .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

      renderApp();

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("connected");
      });
      expect(screen.getByTestId("address").textContent).toBe(TEST_ADDRESS);
      expect(screen.getByTestId("error").textContent).toBe("");
      expect(sessionStorage.getItem("walletAddress")).toBe(TEST_ADDRESS);
    });

    it("sets status to error when Freighter not detected", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      (window as any).stellar = undefined;

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("error");
      });
      expect(screen.getByTestId("error").textContent).toBe(
        "Stellar wallet provider (Freighter) not detected",
      );
      expect(screen.getByTestId("address").textContent).toBe("");
    });

    it("sets status to error when no public key returned", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      (window as any).stellar = {
        getPublicKey: vi.fn().mockResolvedValue(null),
        signTransaction: vi.fn(),
      };

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("error");
      });
      expect(screen.getByTestId("error").textContent).toBe("No public key returned from wallet");
    });

    it("sets status to error when challenge API fails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar();
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse(false, { error: "Server error" }, 500),
      );

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("error");
      });
      expect(screen.getByTestId("error").textContent).toBe("Server error");
    });

    it("sets status to error when verify API fails", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar();
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
        .mockResolvedValueOnce(mockResponse(false, { error: "Invalid signature" }, 400));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("error");
      });
      expect(screen.getByTestId("error").textContent).toBe("Invalid signature");
    });

    it("clears previous error on new connect attempt", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      (window as any).stellar = undefined;

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      // First attempt fails
      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("error");
      });
      expect(screen.getByTestId("error").textContent).toBe(
        "Stellar wallet provider (Freighter) not detected",
      );

      // Second attempt succeeds
      setupStellar();
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
        .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("connected");
      });
      expect(screen.getByTestId("error").textContent).toBe("");
      expect(screen.getByTestId("address").textContent).toBe(TEST_ADDRESS);
      expect(sessionStorage.getItem("walletAddress")).toBe(TEST_ADDRESS);
    });
  });

  describe("disconnect", () => {
    it("transitions from connected to disconnected", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(false))
        .mockResolvedValueOnce(mockResponse(true));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("connected");
      });

      await act(async () => {
        screen.getByTestId("disconnect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });
      expect(screen.getByTestId("address").textContent).toBe("");
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("clears state even when server session DELETE fails", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(false))
        .mockRejectedValueOnce(new Error("Network error"));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("connected");
      });

      await act(async () => {
        screen.getByTestId("disconnect-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });
      expect(screen.getByTestId("address").textContent).toBe("");
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("works when already disconnected", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(false))
        .mockResolvedValueOnce(mockResponse(true));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("status").textContent).toBe("disconnected");
      });

      await act(async () => {
        screen.getByTestId("disconnect-btn").click();
      });

      expect(screen.getByTestId("status").textContent).toBe("disconnected");
      expect(screen.getByTestId("address").textContent).toBe("");
    });
  });

  describe("network state", () => {
    it("resolves to TESTNET for testnet config", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => useWalletContext(), { wrapper });

      await waitFor(() => expect(result.current.status).toBe("disconnected"));
      expect(result.current.network).toBe("TESTNET");
    });

    it("resolves to PUBLIC for mainnet config", async () => {
      vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "mainnet");
      vi.resetModules();

      const { WalletProvider: WP2, useWalletContext: UC2 } = await import(
        "./WalletContext"
      );
      const Wrapper2: FC<{ children: ReactNode }> = ({ children }) =>
        createElement(WP2, null, children);

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => UC2(), { wrapper: Wrapper2 });

      await waitFor(() => expect(result.current.status).toBe("disconnected"));
      expect(result.current.network).toBe("PUBLIC");
      vi.unstubAllEnvs();
    });

    it("resolves to PUBLIC for PUBLIC string config", async () => {
      vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "PUBLIC");
      vi.resetModules();

      const { WalletProvider: WP3, useWalletContext: UC3 } = await import(
        "./WalletContext"
      );
      const Wrapper3: FC<{ children: ReactNode }> = ({ children }) =>
        createElement(WP3, null, children);

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => UC3(), { wrapper: Wrapper3 });

      await waitFor(() => expect(result.current.status).toBe("disconnected"));
      expect(result.current.network).toBe("PUBLIC");
      vi.unstubAllEnvs();
    });
  });

  describe("consumer re-renders on state change", () => {
    it("re-renders consumers when connect succeeds", async () => {
      const renderSpy = vi.fn();

      function Tracker() {
        const ctx = useWalletContext();
        renderSpy({ status: ctx.status, address: ctx.address });
        return null;
      }

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar();
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
        .mockResolvedValueOnce(mockResponse(true, { walletAddress: TEST_ADDRESS }));

      function App() {
        const ctx = useWalletContext();
        return createElement("div", null,
          createElement(Tracker),
          createElement("button", {
            "data-testid": "connect-btn",
            onClick: () => { ctx.connect(); },
          }, "Connect"),
        );
      }

      render(createElement(WalletProvider, null, createElement(App)));

      await waitFor(() => {
        expect(renderSpy).toHaveBeenLastCalledWith({
          status: "disconnected",
          address: null,
        });
      });

      renderSpy.mockClear();

      await act(async () => {
        screen.getByTestId("connect-btn").click();
      });

      await waitFor(() => {
        expect(renderSpy).toHaveBeenLastCalledWith({
          status: "connected",
          address: TEST_ADDRESS,
        });
      });
    });

    it("re-renders consumers when disconnect completes", async () => {
      const renderSpy = vi.fn();

      function Tracker() {
        const ctx = useWalletContext();
        renderSpy({ status: ctx.status, address: ctx.address });
        return null;
      }

      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      // Server confirms session so state stays "connected" after rehydration
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockResponse(true, {
            session: { user: { walletAddress: TEST_ADDRESS } },
          }),
        )
        .mockResolvedValueOnce(mockResponse(true));

      function App() {
        const ctx = useWalletContext();
        return createElement("div", null,
          createElement(Tracker),
          createElement("button", {
            "data-testid": "disconnect-btn",
            onClick: () => { ctx.disconnect(); },
          }, "Disconnect"),
        );
      }

      render(createElement(WalletProvider, null, createElement(App)));

      await waitFor(() => {
        expect(renderSpy).toHaveBeenLastCalledWith({
          status: "connected",
          address: TEST_ADDRESS,
        });
      });

      const callCountBefore = renderSpy.mock.calls.length;

      await act(async () => {
        screen.getByTestId("disconnect-btn").click();
      });

      await waitFor(() => {
        expect(renderSpy.mock.calls.length).toBeGreaterThan(callCountBefore);
        expect(renderSpy).toHaveBeenLastCalledWith({
          status: "disconnected",
          address: null,
        });
      });
    });
  });

  describe("useWalletContext", () => {
    it("throws when used outside WalletProvider", () => {
      expect(() => renderHook(() => useWalletContext())).toThrow(
        "useWalletContext must be used within a WalletProvider",
      );
    });
  });
});
