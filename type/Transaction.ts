// types/Transaction.ts

export type TransactionStatus = "completed" | "processing" | "failed";

export interface Transaction {
  id: number;
  type: string;
  amount: string;
  asset: string;
  date: string; // ISO format or 'YYYY-MM-DD'
  time: string; // HH:mm or AM/PM format
  status: TransactionStatus;
}
