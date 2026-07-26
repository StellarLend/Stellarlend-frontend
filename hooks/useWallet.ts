import { useWalletContext } from "@/context/WalletContext";

export const useWallet = () => {
  const {
    address,
    accounts,
    activeAccount,
    network,
    status,
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
    error,
    connect,
    disconnect,
    switchAccount,
  };
};
