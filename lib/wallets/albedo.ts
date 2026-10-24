import { WalletAdapter, SignTransactionOptions } from "./types";

export const albedoAdapter: WalletAdapter = {
  id: "albedo",
  name: "Albedo",
  icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%2310b981' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M12 7l5 10H7z' fill='white'/></svg>",

  async isAvailable(): Promise<boolean> {
    // Albedo works in any web browser via albedo.link popup/web intent
    return typeof window !== "undefined";
  },

  async connect(): Promise<string> {
    const albedoModule = await import("@albedo-link/intent");
    const albedo = albedoModule.default ?? albedoModule;
    const res = await albedo.publicKey({});
    if (!res?.pubkey) {
      throw new Error("Could not retrieve public key from Albedo.");
    }
    return res.pubkey;
  },

  async signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string> {
    const albedoModule = await import("@albedo-link/intent");
    const albedo = albedoModule.default ?? albedoModule;
    const res = await albedo.tx({
      xdr,
      network: options?.networkPassphrase,
      pubkey: options?.accountToSign,
    });
    if (!res?.signed_envelope_xdr) {
      throw new Error("Transaction signing was rejected or failed.");
    }
    return res.signed_envelope_xdr;
  },

  async disconnect(): Promise<void> {
    // Stateless web intent
  },
};
