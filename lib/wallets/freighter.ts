import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";
import { WalletAdapter, SignTransactionOptions } from "./types";

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%236366f1' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M7 12l3 3 7-7' stroke='white' stroke-width='2' fill='none'/></svg>",

  async isAvailable(): Promise<boolean> {
    try {
      const res = await isConnected();
      return Boolean(res?.isConnected ?? res);
    } catch {
      return false;
    }
  },

  async connect(): Promise<string> {
    const connectedRes = await isConnected();
    const connected = Boolean(connectedRes?.isConnected ?? connectedRes);
    if (!connected) {
      throw new Error("Freighter wallet is not installed or not available.");
    }

    const allowedRes = await isAllowed();
    const allowed = Boolean(allowedRes?.isAllowed ?? allowedRes);
    if (!allowed) {
      const setRes = await setAllowed();
      const granted = Boolean(setRes?.isAllowed ?? setRes);
      if (!granted) {
        const reqRes = await requestAccess();
        const address = typeof reqRes === "string" ? reqRes : reqRes?.address;
        if (!address) {
          throw new Error("User rejected connection request.");
        }
        return address;
      }
    }

    const addrRes = await getAddress();
    const address = typeof addrRes === "string" ? addrRes : addrRes?.address;
    if (!address) {
      throw new Error("Could not retrieve public key from Freighter.");
    }
    return address;
  },

  async signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string> {
    const res = await freighterSignTransaction(xdr, {
      networkPassphrase: options?.networkPassphrase,
      address: options?.accountToSign,
    });
    const signedXdr = typeof res === "string" ? res : res?.signedTxXdr;
    if (!signedXdr) {
      throw new Error("Transaction signing was rejected or failed.");
    }
    return signedXdr;
  },

  async disconnect(): Promise<void> {
    // Freighter does not have an explicit programmatic disconnect method
  },
};
