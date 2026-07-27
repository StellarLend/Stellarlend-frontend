import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWallet } from "./useWallet";
import { useWalletContext } from "@/context/WalletContext";

vi.mock("@/context/WalletContext", () => ({
  useWalletContext: vi.fn(),
}));

const mockedUseWalletContext = vi.mocked(useWalletContext);

const contextValue = {
  address: "GABCDEF1234567890",
  accounts: [
    "GABCDEF1234567890",
    "GDUMMYADDRESSABCDEFGH1234567890ABCDEF1234567",
  ],
  activeAccount: "GABCDEF1234567890",
  network: "TESTNET" as const,
  status: "connected" as const,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchAccount: vi.fn(),
};

describe("useWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseWalletContext.mockReturnValue(contextValue);
  });

  it("forwards all wallet context values", () => {
    const { result } = renderHook(() => useWallet());

    expect(result.current.address).toBe(contextValue.address);
    expect(result.current.accounts).toEqual(contextValue.accounts);
    expect(result.current.activeAccount).toBe(contextValue.activeAccount);
    expect(result.current.network).toBe(contextValue.network);
    expect(result.current.status).toBe(contextValue.status);
    expect(result.current.error).toBe(contextValue.error);
  });

  it("forwards connect, disconnect, and switchAccount functions", async () => {
    const { result } = renderHook(() => useWallet());

    await result.current.connect();
    await result.current.disconnect();
    await result.current.switchAccount("GDUMMYADDRESSABCDEFGH1234567890ABCDEF1234567");

    expect(contextValue.connect).toHaveBeenCalledTimes(1);
    expect(contextValue.disconnect).toHaveBeenCalledTimes(1);
    expect(contextValue.switchAccount).toHaveBeenCalledWith(
      "GDUMMYADDRESSABCDEFGH1234567890ABCDEF1234567",
    );
  });

  it("calls useWalletContext exactly once", () => {
    renderHook(() => useWallet());
    expect(mockedUseWalletContext).toHaveBeenCalledTimes(1);
  });
});
