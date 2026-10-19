export const config = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
  horizon: process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org",
  rpc: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  lendingId: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || "",
  oracleId: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID || "",
  tokenId: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
  multisigId: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID || "",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
};
export const explorer = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
export const txExplorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
