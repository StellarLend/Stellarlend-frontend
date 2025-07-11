export type TransactionStatus = "Completed" | "Processing" | "Failed";

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  asset: "XLM" | "BTC" | "STRK";
  date: string;
  time: string;
  status: TransactionStatus;
}

export const fetchTransactions = async (): Promise<Transaction[]> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return [
    {
      id: "TXN12345",
      type: "Deposit",
      amount: 2000,
      asset: "XLM",
      date: "2025-04-12",
      time: "09:32AM",
      status: "Completed",
    },
    {
      id: "TXN12346",
      type: "Loan Payment",
      amount: -250,
      asset: "BTC",
      date: "2025-03-10",
      time: "11:15AM",
      status: "Processing",
    },
    {
      id: "TXN12347",
      type: "Withdrawal",
      amount: -7500,
      asset: "STRK",
      date: "2025-02-28",
      time: "04:45PM",
      status: "Completed",
    },
    {
      id: "TXN12348",
      type: "Lend Funds",
      amount: -1500,
      asset: "XLM",
      date: "2025-01-05",
      time: "08:00AM",
      status: "Completed",
    },
    {
      id: "TXN12349",
      type: "Lend Funds",
      amount: -607.87,
      asset: "BTC",
      date: "2024-12-20",
      time: "10:20PM",
      status: "Failed",
    },
    {
      id: "TXN12350",
      type: "Deposit",
      amount: 20000,
      asset: "STRK",
      date: "2024-11-15",
      time: "01:05PM",
      status: "Completed",
    },
    // Add more transactions as needed
  ];
};
