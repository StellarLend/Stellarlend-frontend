import { WalletAdapter, SignTransactionOptions } from "./types";

export const xbullAdapter: WalletAdapter = {
  id: "xbull",
  name: "xBull",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%23ef4444' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='12' cy='12' r='5' fill='white'/></svg>",

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { xbull?: unknown }).xbull);
  },

  async connect(): Promise<string> {
    const { xBullWalletConnect } = await import("@creit.tech/xbull-wallet-connect");
    const bridge = new xBullWalletConnect();
    try {
      const publicKey = await bridge.connect();
      bridge.closeWallet();
      if (!publicKey) {
        throw new Error("Could not retrieve public key from xBull.");
      }
      return publicKey;
    } catch (err) {
      bridge.closeWallet();
      throw err;
    }
  },

  async signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string> {
    const { xBullWalletConnect } = await import("@creit.tech/xbull-wallet-connect");
    const bridge = new xBullWalletConnect();
    try {
      const signedXdr = await bridge.sign({
        xdr,
        publicKey: options?.accountToSign,
        network: options?.networkPassphrase,
      });
      bridge.closeWallet();
      if (!signedXdr) {
        throw new Error("Transaction signing was rejected or failed.");
      }
      return signedXdr;
    } catch (err) {
      bridge.closeWallet();
      throw err;
    }
  },

  async disconnect(): Promise<void> {
    // xBull bridge closes after operations
  },
};
