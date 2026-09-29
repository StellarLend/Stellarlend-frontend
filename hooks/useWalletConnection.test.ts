import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWalletConnection } from "./useWalletConnection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const TEST_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const VALID_ADDRESS = "GAUFVBMULU2CJRE5IGVPEOXRYZGU5YDAOSQ3UQTBM3Y7ARUPFSXZUHN5";
const OTHER_ADDRESS = "GBCKQ7BCF4O7SWKH3GF7G2KRPSURA2HU5WQJRHMIFR3P6DBGVT45XLR3";

function mockResponse(ok: boolean, body: any = {}, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function sessionBody(walletAddress = VALID_ADDRESS, network = "TESTNET") {
  return {
    session: {
      active: true,
      network,
      user: { walletAddress },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

function setupStellar(pubKey = VALID_ADDRESS) {
  (window as any).stellar = {
    getPublicKey: vi.fn().mockResolvedValue(pubKey),
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

describe("useWalletConnection", () => {
  describe("initial state", () => {
    it("starts disconnected with null address", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.status).toBe("disconnected");
      expect(result.current.address).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("derives network from config (testnet)", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.network).toBe("TESTNET");
    });
  });

  describe("rehydration", () => {
    it("restores only after server confirms the stored wallet", async () => {
      sessionStorage.setItem("walletAddress", VALID_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, sessionBody()));

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => {
        expect(result.current.address).toBe(VALID_ADDRESS);
        expect(result.current.status).toBe("connected");
        expect(result.current.isConnected).toBe(true);
      });
    });

    it("clears state when server has no session", async () => {
      sessionStorage.setItem("walletAddress", TEST_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, { session: {} }));

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.status).toBe("disconnected");
      });
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("clears tampered storage when the server confirms a different wallet", async () => {
      sessionStorage.setItem("walletAddress", VALID_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse(true, sessionBody(OTHER_ADDRESS)),
      );

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.status).toBe("disconnected");
      });
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("clears state for malformed or wrong-network session responses", async () => {
      sessionStorage.setItem("walletAddress", VALID_ADDRESS);
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(true, sessionBody(VALID_ADDRESS, "PUBLIC")));

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => {
        expect(result.current.address).toBeNull();
        expect(result.current.status).toBe("disconnected");
      });
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });
  });

  describe("connect", () => {
    it("transitions to connected on success and persists to sessionStorage", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar();
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, { transaction: "challenge-xdr" }))
        .mockResolvedValueOnce(mockResponse(true, { walletAddress: VALID_ADDRESS }));

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe("connected");
      expect(result.current.address).toBe(VALID_ADDRESS);
      expect(result.current.isConnected).toBe(true);
      expect(sessionStorage.getItem("walletAddress")).toBe(VALID_ADDRESS);
    });

    it("rejects a public key with an invalid length/prefix, matching WalletContext behavior", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      setupStellar("not-a-valid-key");

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Invalid Stellar public key");
      expect(result.current.address).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });

    it("sets error when Freighter is not detected", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse(false));
      (window as any).stellar = undefined;

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Stellar wallet provider (Freighter) not detected");
    });
  });

  describe("disconnect", () => {
    it("clears state on disconnect", async () => {
      sessionStorage.setItem("walletAddress", VALID_ADDRESS);
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse(true, sessionBody()))
        .mockResolvedValueOnce(mockResponse(true));

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => expect(result.current.status).toBe("connected"));

      await act(async () => {
        await result.current.disconnect();
      });

      expect(result.current.status).toBe("disconnected");
      expect(result.current.address).toBeNull();
      expect(sessionStorage.getItem("walletAddress")).toBeNull();
    });
  });
});
