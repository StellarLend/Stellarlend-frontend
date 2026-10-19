// Well-known Stellar testnet asset issuers
// Source for USDC & EURC: Circle official testnet documentation
// https://developers.circle.com/stablecoins/docs/stellar-testnet-usdc
export const TESTNET_ISSUERS = {
  USDC: process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  EURC: process.env.NEXT_PUBLIC_EURC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  // Demo testnet BTC anchor issuer
  BTC: process.env.NEXT_PUBLIC_BTC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

export const config = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
  horizon: process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org",
  rpc: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  lendingId: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || "",
  oracleId: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID || "",
  tokenId: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
  multisigId: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID || "",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
  ammId: process.env.NEXT_PUBLIC_AMM_CONTRACT_ID || "",
  ammTokenAId: process.env.NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID || "",
  ammTokenBId: process.env.NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID || "",
  ammTokenAHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET || "",
  ammTokenBHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET || "",
};
export const explorer = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
export const txExplorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
