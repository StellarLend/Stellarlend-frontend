import type { AssetSymbol, TransactionType, TransactionStatus } from "./enums";

export type { AssetSymbol, TransactionType, TransactionStatus };

export interface Transaction {
  id: string;
  txHash?: string;
  hash?: string;
  type: TransactionType;
  amount: number;
  asset: AssetSymbol;
  date: string;
  time: string;
  status: TransactionStatus;
}

export interface InFlightTx {
  hash: string;
  type: TransactionType;
  amount: number;
  asset: AssetSymbol;
}

export type FetchTransactionsOptions = {
  page?: number;
  pageSize?: number;
  cursor?: string;
  limit?: number;
  search?: string;
  status?: TransactionStatus;
  type?: string;
  asset?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "date" | "amount";
  sortDir?: "asc" | "desc";
};

export type FetchTransactionsResponse = {
  transactions: Transaction[];
  total: number;
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export const fetchTransactions = async (
  params: FetchTransactionsOptions = {},
): Promise<FetchTransactionsResponse> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const url = `/api/transactions${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load transactions: ${response.status}`);
  }

  const body = (await response.json()) as FetchTransactionsResponse;
  return body;
};
