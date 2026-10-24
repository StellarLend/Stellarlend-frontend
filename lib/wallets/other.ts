import { WalletAdapter, SignTransactionOptions } from "./types";

interface LobstrSigner {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signXdr: (xdr: string) => Promise<string>;
}

export const lobstrAdapter: WalletAdapter = {
  id: "lobstr",
  name: "LOBSTR",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%233b82f6' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='8' cy='12' r='3' fill='white'/><circle cx='16' cy='12' r='3' fill='white'/></svg>",

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { lobstr?: LobstrSigner }).lobstr);
  },

  async connect(): Promise<string> {
    const lobstr = (window as unknown as { lobstr?: LobstrSigner }).lobstr;
    if (!lobstr) {
      throw new Error("LOBSTR extension is not installed.");
    }
    const pubKey = await lobstr.getPublicKey();
    if (!pubKey) {
      throw new Error("Could not retrieve public key from LOBSTR.");
    }
    return pubKey;
  },

  async signTransaction(xdr: string, _options?: SignTransactionOptions): Promise<string> {
    const lobstr = (window as unknown as { lobstr?: LobstrSigner }).lobstr;
    if (!lobstr) {
      throw new Error("LOBSTR extension is not installed.");
    }
    const signed = await lobstr.signXdr(xdr);
    if (!signed) {
      throw new Error("Transaction signing was rejected or failed.");
    }
    return signed;
  },

  async disconnect(): Promise<void> {},
};

interface RabetSigner {
  connect: () => Promise<{ publicKey: string }>;
  sign: (xdr: string, network: string) => Promise<{ xdr: string }>;
}

export const rabetAdapter: WalletAdapter = {
  id: "rabet",
  name: "Rabet",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%23f59e0b' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M8 16V8l8 8V8' stroke='white' stroke-width='2'/></svg>",

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { rabet?: RabetSigner }).rabet);
  },

  async connect(): Promise<string> {
    const rabet = (window as unknown as { rabet?: RabetSigner }).rabet;
    if (!rabet) {
      throw new Error("Rabet extension is not installed.");
    }
    const res = await rabet.connect();
    if (!res?.publicKey) {
      throw new Error("Could not retrieve public key from Rabet.");
    }
    return res.publicKey;
  },

  async signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string> {
    const rabet = (window as unknown as { rabet?: RabetSigner }).rabet;
    if (!rabet) {
      throw new Error("Rabet extension is not installed.");
    }
    const network = options?.networkPassphrase?.toLowerCase().includes("testnet")
      ? "testnet"
      : "mainnet";
    const res = await rabet.sign(xdr, network);
    if (!res?.xdr) {
      throw new Error("Transaction signing was rejected or failed.");
    }
    return res.xdr;
  },

  async disconnect(): Promise<void> {},
};

interface HanaSigner {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export const hanaAdapter: WalletAdapter = {
  id: "hana",
  name: "Hana",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%238b5cf6' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='12' cy='12' r='4' stroke='white' stroke-width='2' fill='none'/></svg>",

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { hanaWallet?: { stellar?: HanaSigner } }).hanaWallet?.stellar);
  },

  async connect(): Promise<string> {
    const stellar = (window as unknown as { hanaWallet?: { stellar?: HanaSigner } }).hanaWallet?.stellar;
    if (!stellar) {
      throw new Error("Hana extension is not installed.");
    }
    const accounts = (await stellar.request({ method: "stellar_requestAccounts" })) as string[];
    if (!accounts?.[0]) {
      throw new Error("Could not retrieve public key from Hana.");
    }
    return accounts[0];
  },

  async signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string> {
    const stellar = (window as unknown as { hanaWallet?: { stellar?: HanaSigner } }).hanaWallet?.stellar;
    if (!stellar) {
      throw new Error("Hana extension is not installed.");
    }
    const res = (await stellar.request({
      method: "stellar_signTransaction",
      params: [{ xdr, networkPassphrase: options?.networkPassphrase }],
    })) as { xdr?: string } | string;
    const signed = typeof res === "string" ? res : res?.xdr;
    if (!signed) {
      throw new Error("Transaction signing was rejected or failed.");
    }
    return signed;
  },

  async disconnect(): Promise<void> {},
};
