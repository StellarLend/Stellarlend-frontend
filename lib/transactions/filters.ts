import type { TransactionStatus, TransactionAsset } from './types';

export type TransactionTypeFilter = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPES = ['lend', 'borrow', 'repay', 'withdraw'] as const;
export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES.map((type) => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1),
}));

export interface TransactionFilter {
  type?: string;
  status?: TransactionStatus;
  asset?: TransactionAsset | string;
  fromDate?: string;
  toDate?: string;
}

const ALLOWED_TYPES = new Set<string>(TRANSACTION_TYPES);
const ALLOWED_STATUSES = new Set(['completed', 'pending', 'failed']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/;

export interface FilterValidationResult {
  valid: boolean;
  filter: TransactionFilter;
  error?: string;
}

export function serializeTransactionFilters(filters: TransactionFilter): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.asset) params.set('asset', filters.asset);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);

  return params;
}

/**
 * Parses and validates query-string parameters into a TransactionFilter.
 * Returns an error string for any invalid value so callers can return 400.
 */
export function parseTransactionFilter(params: URLSearchParams): FilterValidationResult {
  const filter: TransactionFilter = {};

  const type = params.get('type');
  if (type) {
    if (!ALLOWED_TYPES.has(type)) {
      return { valid: false, filter, error: `Invalid type: ${type}` };
    }
    filter.type = type as TransactionFilter['type'];
  }

  const status = params.get('status');
  if (status) {
    const normalizedStatus = status.toLowerCase();
    if (!ALLOWED_STATUSES.has(normalizedStatus)) {
      return { valid: false, filter, error: `Invalid status: ${status}` };
    }

    if (normalizedStatus === 'all') {
      filter.status = 'All';
    } else if (normalizedStatus === 'completed') {
      filter.status = 'Completed';
    } else if (normalizedStatus === 'processing') {
      filter.status = 'Processing';
    } else {
      filter.status = 'Failed';
    }
  }

  const asset = params.get('asset');
  if (asset) {
    if (!/^[A-Za-z0-9]{1,12}$/.test(asset)) {
      return { valid: false, filter, error: `Invalid asset: ${asset}` };
    }
    filter.asset = asset.toUpperCase();
  }

  const fromDate = params.get('fromDate');
  if (fromDate) {
    if (!ISO_DATE_RE.test(fromDate)) {
      return { valid: false, filter, error: `Invalid fromDate: ${fromDate}` };
    }
    filter.fromDate = fromDate;
  }

  const toDate = params.get('toDate');
  if (toDate) {
    if (!ISO_DATE_RE.test(toDate)) {
      return { valid: false, filter, error: `Invalid toDate: ${toDate}` };
    }
    filter.toDate = toDate;
  }

  return { valid: true, filter };
}
