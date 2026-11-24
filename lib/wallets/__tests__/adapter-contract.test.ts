import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeWalletError,
  withSigningTimeout,
  SIGNING_TIMEOUT_MS,
  type WalletAdapter,
  type WalletErrorCode,
} from "../types";

const TEST_PUBKEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TEST_XDR = "AAAAAgAAAABdummyUnsignedXdr==";
const TEST_SIGNED_XDR = "AAAAAgAAAABdummySignedXdr==";
const TEST_PASSPHRASE = "Test SDF Network ; September 2015";

// --- Vendor SDK mocks ---

const freighterMocks = {
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
};

vi.mock("@stellar/freighter-api", () => ({
  isConnected: (...args: unknown[]) => freighterMocks.isConnected(...args),
  isAllowed: (...args: unknown[]) => freighterMocks.isAllowed(...args),
  setAllowed: (...args: unknown[]) => freighterMocks.setAllowed(...args),
  requestAccess: (...args: unknown[]) => freighterMocks.requestAccess(...args),
  getAddress: (...args: unknown[]) => freighterMocks.getAddress(...args),
  signTransaction: (...args: unknown[]) => freighterMocks.signTransaction(...args),
}));

const albedoMocks = {
  moduleLoaded: vi.fn(),
  publicKey: vi.fn(),
  tx: vi.fn(),
};

vi.mock("@albedo-link/intent", () => {
  albedoMocks.moduleLoaded();
  return {
    default: {
      publicKey: (...args: unknown[]) => albedoMocks.publicKey(...args),
      tx: (...args: unknown[]) => albedoMocks.tx(...args),
    },
  };
});

const xbullMocks = {
  moduleLoaded: vi.fn(),
  connect: vi.fn(),
  sign: vi.fn(),
  closeWallet: vi.fn(),
};

vi.mock("@creit.tech/xbull-wallet-connect", () => {
  xbullMocks.moduleLoaded();
  return {
    xBullWalletConnect: class MockXBullWalletConnect {
      connect() {
        return xbullMocks.connect();
      }
      sign(params: unknown) {
        return xbullMocks.sign(params);
      }
      closeWallet() {
        return xbullMocks.closeWallet();
      }
    },
  };
});

// --- Adapter imports (after mocks) ---
import { freighterAdapter } from "../freighter";
import { albedoAdapter } from "../albedo";
import { xbullAdapter } from "../xbull";
import { lobstrAdapter, rabetAdapter, hanaAdapter } from "../other";

interface AdapterContractCase {
  name: string;
  adapter: WalletAdapter;
  setupSuccess: () => void;
  setupRejection: () => void;
  assertNetworkPassphraseForwarded: () => void;
  cleanup?: () => void;
}

const getWin = () => window as unknown as Record<string, unknown>;

const adapterCases: AdapterContractCase[] = [
  {
    name: "Freighter (freighter.ts)",
    adapter: freighterAdapter,
    setupSuccess: () => {
      freighterMocks.isConnected.mockResolvedValue({ isConnected: true });
      freighterMocks.isAllowed.mockResolvedValue({ isAllowed: true });
      freighterMocks.getAddress.mockResolvedValue({ address: TEST_PUBKEY });
      freighterMocks.signTransaction.mockResolvedValue({ signedTxXdr: TEST_SIGNED_XDR });
    },
    setupRejection: () => {
      freighterMocks.isConnected.mockResolvedValue({ isConnected: true });
      freighterMocks.isAllowed.mockResolvedValue({ isAllowed: false });
      freighterMocks.setAllowed.mockResolvedValue({ isAllowed: false });
      freighterMocks.requestAccess.mockRejectedValue(new Error("User declined access"));
      freighterMocks.signTransaction.mockRejectedValue(new Error("User declined to sign"));
    },
    assertNetworkPassphraseForwarded: () => {
      expect(freighterMocks.signTransaction).toHaveBeenCalledWith(
        TEST_XDR,
        expect.objectContaining({ networkPassphrase: TEST_PASSPHRASE })
      );
    },
  },
  {
    name: "Albedo (albedo.ts)",
    adapter: albedoAdapter,
    setupSuccess: () => {
      albedoMocks.publicKey.mockResolvedValue({ pubkey: TEST_PUBKEY });
      albedoMocks.tx.mockResolvedValue({ signed_envelope_xdr: TEST_SIGNED_XDR });
    },
    setupRejection: () => {
      albedoMocks.publicKey.mockRejectedValue({ code: -4, message: "Popup closed" });
      albedoMocks.tx.mockRejectedValue({
        code: -1,
        message: "Action request was rejected by the user.",
      });
    },
    assertNetworkPassphraseForwarded: () => {
      expect(albedoMocks.tx).toHaveBeenCalledWith(
        expect.objectContaining({ xdr: TEST_XDR, network: TEST_PASSPHRASE })
      );
    },
  },
  {
    name: "xBull (xbull.ts)",
    adapter: xbullAdapter,
    setupSuccess: () => {
      getWin().xbull = {};
      xbullMocks.connect.mockResolvedValue(TEST_PUBKEY);
      xbullMocks.sign.mockResolvedValue(TEST_SIGNED_XDR);
    },
    setupRejection: () => {
      getWin().xbull = {};
      xbullMocks.connect.mockRejectedValue(new Error("User rejected connection"));
      xbullMocks.sign.mockRejectedValue(new Error("Request cancelled by user"));
    },
    assertNetworkPassphraseForwarded: () => {
      expect(xbullMocks.sign).toHaveBeenCalledWith(
        expect.objectContaining({ xdr: TEST_XDR, network: TEST_PASSPHRASE })
      );
    },
    cleanup: () => {
      delete getWin().xbull;
    },
  },
  {
    name: "Rabet (other.ts)",
    adapter: rabetAdapter,
    setupSuccess: () => {
      getWin().rabet = {
        connect: vi.fn().mockResolvedValue({ publicKey: TEST_PUBKEY }),
        sign: vi.fn().mockResolvedValue({ xdr: TEST_SIGNED_XDR }),
      };
    },
    setupRejection: () => {
      getWin().rabet = {
        connect: vi.fn().mockRejectedValue({ error: "user-rejected" }),
        sign: vi.fn().mockRejectedValue({ error: "user-rejected" }),
      };
    },
    assertNetworkPassphraseForwarded: () => {
      const rabet = getWin().rabet as { sign: ReturnType<typeof vi.fn> };
      expect(rabet.sign).toHaveBeenCalledWith(TEST_XDR, "testnet");
    },
    cleanup: () => {
      delete getWin().rabet;
    },
  },
  {
    name: "Hana (other.ts)",
    adapter: hanaAdapter,
    setupSuccess: () => {
      getWin().hanaWallet = {
        stellar: {
          request: vi.fn().mockImplementation(async ({ method }: { method: string }) => {
            if (method === "stellar_requestAccounts") return [TEST_PUBKEY];
            if (method === "stellar_signTransaction") return { xdr: TEST_SIGNED_XDR };
            return null;
          }),
        },
      };
    },
    setupRejection: () => {
      getWin().hanaWallet = {
        stellar: {
          request: vi.fn().mockRejectedValue({ code: 4001, message: "User rejected the request" }),
        },
      };
    },
    assertNetworkPassphraseForwarded: () => {
      const stellar = (getWin().hanaWallet as { stellar: { request: ReturnType<typeof vi.fn> } })
        .stellar;
      expect(stellar.request).toHaveBeenCalledWith({
        method: "stellar_signTransaction",
        params: [{ xdr: TEST_XDR, networkPassphrase: TEST_PASSPHRASE }],
      });
    },
    cleanup: () => {
      delete getWin().hanaWallet;
    },
  },
  {
    name: "LOBSTR (other.ts)",
    adapter: lobstrAdapter,
    setupSuccess: () => {
      getWin().lobstr = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockResolvedValue(TEST_PUBKEY),
        signXdr: vi.fn().mockResolvedValue(TEST_SIGNED_XDR),
      };
    },
    setupRejection: () => {
      getWin().lobstr = {
        isConnected: vi.fn().mockResolvedValue(true),
        getPublicKey: vi.fn().mockRejectedValue(new Error("User rejected")),
        signXdr: vi.fn().mockRejectedValue(new Error("User declined")),
      };
    },
    assertNetworkPassphraseForwarded: () => {
      // LOBSTR's signXdr(xdr) takes only xdr; verify it was invoked with the XDR
      const lobstr = getWin().lobstr as { signXdr: ReturnType<typeof vi.fn> };
      expect(lobstr.signXdr).toHaveBeenCalledWith(TEST_XDR);
    },
    cleanup: () => {
      delete getWin().lobstr;
    },
  },
];

describe("Wallet Adapter Shared Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const c of adapterCases) {
      c.cleanup?.();
    }
  });

  describe.each(adapterCases)("$name", (tc) => {
    it("reports availability when vendor is present", async () => {
      tc.setupSuccess();
      await expect(tc.adapter.isAvailable()).resolves.toBe(true);
    });

    it("connect returns a public key address", async () => {
      tc.setupSuccess();
      const address = await tc.adapter.connect();
      expect(address).toBe(TEST_PUBKEY);
    });

    it("signTransaction returns signed XDR and forwards networkPassphrase", async () => {
      tc.setupSuccess();
      const signed = await tc.adapter.signTransaction(TEST_XDR, {
        networkPassphrase: TEST_PASSPHRASE,
        accountToSign: TEST_PUBKEY,
      });
      expect(signed).toBe(TEST_SIGNED_XDR);
      tc.assertNetworkPassphraseForwarded();
    });

    it("connect rejection normalizes to user_rejected", async () => {
      tc.setupRejection();
      await expect(tc.adapter.connect()).rejects.toSatisfy((err: unknown) => {
        return normalizeWalletError(err).code === "user_rejected";
      });
    });

    it("signTransaction rejection normalizes to user_rejected", async () => {
      tc.setupRejection();
      await expect(
        tc.adapter.signTransaction(TEST_XDR, { networkPassphrase: TEST_PASSPHRASE })
      ).rejects.toSatisfy((err: unknown) => {
        return normalizeWalletError(err).code === "user_rejected";
      });
    });

    it("disconnect resolves cleanly", async () => {
      await expect(tc.adapter.disconnect()).resolves.toBeUndefined();
    });
  });
});

describe("normalizeWalletError", () => {
  const table: Array<{ label: string; input: unknown; expectedCode: WalletErrorCode }> = [
    // user_rejected
    {
      label: "Freighter rejection message",
      input: new Error("User rejected connection request."),
      expectedCode: "user_rejected",
    },
    {
      label: "Freighter declined access",
      input: new Error("User declined access"),
      expectedCode: "user_rejected",
    },
    {
      label: "Albedo popup closed object",
      input: { code: -4, message: "Popup closed" },
      expectedCode: "user_rejected",
    },
    {
      label: "Albedo popup closed Error",
      input: new Error("Popup closed"),
      expectedCode: "user_rejected",
    },
    {
      label: "Albedo action rejected code -1",
      input: { code: -1, message: "Action request was rejected by the user." },
      expectedCode: "user_rejected",
    },
    {
      label: "EIP-1193 / Hana 4001 rejection",
      input: { code: 4001, message: "User rejected the request" },
      expectedCode: "user_rejected",
    },
    {
      label: "Rabet user-rejected object",
      input: { error: "user-rejected" },
      expectedCode: "user_rejected",
    },
    {
      label: "xBull cancelled request",
      input: new Error("Request cancelled"),
      expectedCode: "user_rejected",
    },
    // not_installed
    {
      label: "Freighter not installed",
      input: new Error("Freighter wallet is not installed or not available."),
      expectedCode: "not_installed",
    },
    {
      label: "LOBSTR extension not installed",
      input: new Error("LOBSTR extension is not installed."),
      expectedCode: "not_installed",
    },
    {
      label: "Wallet not detected",
      input: new Error("Wallet not detected"),
      expectedCode: "not_installed",
    },
    // locked
    {
      label: "Wallet is locked",
      input: new Error("Wallet is locked"),
      expectedCode: "locked",
    },
    {
      label: "Unlock your wallet",
      input: new Error("Please unlock your wallet to continue"),
      expectedCode: "locked",
    },
    {
      label: "Rabet not-logged-in",
      input: { error: "not-logged-in" },
      expectedCode: "locked",
    },
    // wrong_network
    {
      label: "Wrong network message",
      input: new Error("Wrong network selected"),
      expectedCode: "wrong_network",
    },
    {
      label: "Network mismatch message",
      input: new Error("Network mismatch: expected testnet"),
      expectedCode: "wrong_network",
    },
    {
      label: "NetworkMismatchError instance",
      input: Object.assign(new Error("Expected testnet"), { name: "NetworkMismatchError" }),
      expectedCode: "wrong_network",
    },
    // unknown
    {
      label: "Generic Error",
      input: new Error("RPC node returned 503"),
      expectedCode: "unknown",
    },
    {
      label: "Plain string",
      input: "Unexpected horizon failure",
      expectedCode: "unknown",
    },
    {
      label: "Raw object without message",
      input: { foo: "bar", nested: { a: 1 } },
      expectedCode: "unknown",
    },
    {
      label: "null input",
      input: null,
      expectedCode: "unknown",
    },
  ];

  it.each(table)("maps $label -> $expectedCode", ({ input, expectedCode }) => {
    const result = normalizeWalletError(input);
    expect(result.code).toBe(expectedCode);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message).not.toContain("[object Object]");
  });

  it("preserves original message on unknown Error and string", () => {
    expect(normalizeWalletError(new Error("Custom RPC timeout"))).toEqual({
      code: "unknown",
      message: "Custom RPC timeout",
    });
    expect(normalizeWalletError("Plain error string")).toEqual({
      code: "unknown",
      message: "Plain error string",
    });
  });

  it("never exposes raw objects on unknown errors", () => {
    const res = normalizeWalletError({ secret: "raw", count: 42 });
    expect(res.code).toBe("unknown");
    expect(res.message).not.toContain("[object Object]");
    expect(res.message).not.toContain("secret");
  });
});

describe("Lazy vendor SDK loading in lib/wallets/index.ts", () => {
  it("does not import @albedo-link/intent or @creit.tech/xbull-wallet-connect at module load", async () => {
    vi.resetModules();
    albedoMocks.moduleLoaded.mockClear();
    xbullMocks.moduleLoaded.mockClear();

    const indexModule = await import("../index");
    expect(indexModule.SUPPORTED_WALLETS.length).toBeGreaterThan(0);
    expect(albedoMocks.moduleLoaded).not.toHaveBeenCalled();
    expect(xbullMocks.moduleLoaded).not.toHaveBeenCalled();
  });
});

describe("withSigningTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when signing finishes before timeout", async () => {
    const result = await withSigningTimeout(Promise.resolve("signed-xdr"), 1000);
    expect(result).toBe("signed-xdr");
  });

  it("rejects after 60s default timeout when signing hangs", async () => {
    vi.useFakeTimers();
    const neverResolving = new Promise<string>(() => {});
    const promise = withSigningTimeout(neverResolving);

    vi.advanceTimersByTime(SIGNING_TIMEOUT_MS);
    await expect(promise).rejects.toThrow(/timed out after 60s/i);
  });
});
