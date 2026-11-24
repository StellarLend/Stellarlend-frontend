/**
 * Re-export barrel — keeps all existing `import … from "@/components/wallet"` or
 * `import … from "./wallet"` imports working without any changes at the call sites.
 *
 * The actual implementation lives in components/wallet/.
 */
export {
  useWallet,
  WalletProvider,
  ConnectButton,
  prefetchWalletPicker,
  LAST_WALLET_STORAGE_KEY,
  AUTOCONNECT_STORAGE_KEY,
  getAutoConnectFlag,
  setAutoConnectFlag,
  useWalletConnection,
  useWalletBalances,
  useFriendbot,
} from "./wallet/index";

export type { WalletCtxValue, AccountStatus } from "./wallet/index";
