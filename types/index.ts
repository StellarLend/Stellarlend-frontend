export type TransactionStatus = 'Completed' | 'Processing' | 'Failed';

export type Transaction = {
  id: string;
  type: string;
  amount: number;
  asset: 'XLM' | 'BTC' | 'STRK';
  date: string;
  time: string;
  status: TransactionStatus;
};