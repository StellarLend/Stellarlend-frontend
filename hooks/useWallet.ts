import { useWalletContext } from "@/context/WalletContext";

export const useWallet = () => {
  const { address, network, status, error, connect, disconnect } = useWalletContext();
  return {
    address,
    network,
    status,
    error,
    connect,
    disconnect,
  };
};
