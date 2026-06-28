import type { TransactionStatus, TransactionAsset } from './types';

export interface TransactionFilter {
  type?: string;
  status?: TransactionStatus;
  asset?: TransactionAsset | string;
  fromDate?: string;
  toDate?: string;
}

const ALLOWED_TYPES   = new Set(['lend', 'borrow', 'repay', 'withdraw']);
const ALLOWED_STATUSES = new Set(['completed', 'pending', 'failed']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/;

export interface FilterValidationResult {
  valid: boolean;
  filter: TransactionFilter;
  error?: string;
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
    if (!ALLOWED_STATUSES.has(status)) {
      return { valid: false, filter, error: `Invalid status: ${status}` };
    }
    filter.status = status as TransactionFilter['status'];
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
