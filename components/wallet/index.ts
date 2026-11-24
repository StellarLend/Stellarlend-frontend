/**
 * Barrel re-export so all existing importers of `@/components/wallet`
 * continue to work without changes.
 */
export { useWallet } from "./wallet-context";
export type { WalletCtxValue, AccountStatus } from "./wallet-context";
export { WalletProvider, prefetchWalletPicker } from "./wallet-provider";
export { ConnectButton } from "./connect-button";
export {
  LAST_WALLET_STORAGE_KEY,
  AUTOCONNECT_STORAGE_KEY,
  getAutoConnectFlag,
  setAutoConnectFlag,
} from "./constants";
export { useWalletConnection } from "./use-wallet-connection";
export { useWalletBalances } from "./use-wallet-balances";
export { useFriendbot } from "./use-friendbot";
