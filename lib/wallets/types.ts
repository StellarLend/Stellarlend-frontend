export interface SignTransactionOptions {
  networkPassphrase?: string;
  accountToSign?: string;
}

export interface WalletAdapter {
  id: string;
  name: string;
  icon: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<string>;
  signTransaction(xdr: string, options?: SignTransactionOptions): Promise<string>;
  disconnect(): Promise<void>;
}
