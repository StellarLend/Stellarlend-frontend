export type TransactionStatus = 'Completed' | 'Processing' | 'Failed';
export type TransactionAsset = 'XLM' | 'BTC' | 'STRK';

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  asset: TransactionAsset;
  date: string;
  time: string;
  status: TransactionStatus;
}

export interface TransactionFilters {
  search?: string;
  status?: TransactionStatus | 'All';
  dateFrom?: string;
  dateTo?: string;
}
