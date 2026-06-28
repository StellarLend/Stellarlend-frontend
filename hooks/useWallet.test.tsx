import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWallet, WalletProvider } from "./useWallet";
import { createElement, type ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WalletProvider, null, children);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).stellar;
});

describe("useWallet", () => {
  it("returns initial disconnected state", () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.account).toBeNull();
    expect(result.current.network).toBe("testnet");
    expect(result.current.isConnected).toBe(false);
  });

  it("loads existing session on mount", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.account).toBe("GABCDEF1234567890");
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("handles no session on mount", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.account).toBeNull();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("handles session fetch error gracefully", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.account).toBeNull();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("reads network from config", () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.network).toBe("testnet");
  });

  it("connects successfully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const mockStellar = {
      getPublicKey: vi.fn().mockResolvedValue("GABCDEF1234567890"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    };
    (window as any).stellar = mockStellar;

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction: "challenge-xdr" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ walletAddress: "GABCDEF1234567890" }),
      } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.account).toBe("GABCDEF1234567890");
    expect(result.current.isConnected).toBe(true);
    expect(mockStellar.getPublicKey).toHaveBeenCalledOnce();
    expect(mockStellar.signTransaction).toHaveBeenCalledOnce();
  });

  it("throws and sets error when Freighter is not available", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    delete (window as any).stellar;

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe(
          "Stellar wallet provider (Freighter) not detected",
        );
      }
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("throws and sets error when Freighter returns no public key", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue(null),
      signTransaction: vi.fn(),
    };

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("No public key returned from wallet");
      }
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("throws and sets error when challenge API fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue("GABCDEF1234567890"),
      signTransaction: vi.fn(),
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("Server error");
      }
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("throws and sets error when challenge API fails with no error message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue("GABCDEF1234567890"),
      signTransaction: vi.fn(),
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("Failed to generate challenge");
      }
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("throws and sets error when verify API fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue("GABCDEF1234567890"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction: "challenge-xdr" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid signature" }),
      } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("Invalid signature");
      }
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("disconnects successfully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.account).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("throws and sets error when disconnect fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { user: { walletAddress: "GABCDEF1234567890" } },
      }),
    } as Response);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    await act(async () => {
      try {
        await result.current.disconnect();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("Failed to disconnect");
      }
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("clears error on subsequent connect attempt", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    delete (window as any).stellar;

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      try {
        await result.current.connect();
      } catch {
        // expected
      }
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(
      "Stellar wallet provider (Freighter) not detected",
    );

    (window as any).stellar = {
      getPublicKey: vi.fn().mockResolvedValue("GABCDEF1234567890"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction: "challenge-xdr" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ walletAddress: "GABCDEF1234567890" }),
      } as Response);

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("throws when used outside WalletProvider", () => {
    expect(() => renderHook(() => useWallet())).toThrow(
      "useWallet must be used within a WalletProvider",
    );
  });
});
