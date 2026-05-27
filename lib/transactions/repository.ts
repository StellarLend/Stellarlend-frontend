export interface Transaction {
  id: string;
  userId: string;
  type: 'lend' | 'borrow' | 'repay' | 'withdraw';
  amount: number;
  asset: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  txHash?: string;
}

export interface TransactionFilter {
  userId?: string;
  type?: Transaction['type'];
  status?: Transaction['status'];
  asset?: string;
  fromDate?: string;
  toDate?: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-001', userId: 'user-1', type: 'lend',     amount: 500,  asset: 'USDC', status: 'completed', timestamp: '2025-01-10T10:00:00Z', txHash: '0xabc1' },
  { id: 'tx-002', userId: 'user-1', type: 'borrow',   amount: 200,  asset: 'XLM',  status: 'completed', timestamp: '2025-01-11T11:00:00Z', txHash: '0xabc2' },
  { id: 'tx-003', userId: 'user-1', type: 'repay',    amount: 200,  asset: 'XLM',  status: 'completed', timestamp: '2025-01-12T09:00:00Z', txHash: '0xabc3' },
  { id: 'tx-004', userId: 'user-2', type: 'lend',     amount: 1000, asset: 'USDC', status: 'completed', timestamp: '2025-01-13T14:00:00Z', txHash: '0xabc4' },
  { id: 'tx-005', userId: 'user-1', type: 'withdraw', amount: 100,  asset: 'USDC', status: 'pending',   timestamp: '2025-01-14T08:00:00Z' },
  { id: 'tx-006', userId: 'user-2', type: 'borrow',   amount: 300,  asset: 'BTC',  status: 'failed',    timestamp: '2025-01-15T16:00:00Z' },
];

export async function fetchTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  let results = [...MOCK_TRANSACTIONS];

  if (filter.userId)   results = results.filter((t) => t.userId === filter.userId);
  if (filter.type)     results = results.filter((t) => t.type === filter.type);
  if (filter.status)   results = results.filter((t) => t.status === filter.status);
  if (filter.asset)    results = results.filter((t) => t.asset === filter.asset);
  if (filter.fromDate) results = results.filter((t) => t.timestamp >= filter.fromDate!);
  if (filter.toDate)   results = results.filter((t) => t.timestamp <= filter.toDate!);

  return results;
}
