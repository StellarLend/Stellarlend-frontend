import { useWalletContext } from "@/context/WalletContext";

export const useWallet = () => {
  const {
    address,
    accounts,
    activeAccount,
    network,
    status,
    isInitializing,
    error,
    connect,
    disconnect,
    switchAccount,
  } = useWalletContext();
  return {
    address,
    accounts,
    activeAccount,
    network,
    status,
    isInitializing,
    error,
    connect,
    disconnect,
    switchAccount,
  };
};
