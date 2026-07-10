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
  from?: string;
  to?: string;
  fromDate?: string;
  toDate?: string;
}

const ALLOWED_TYPES = new Set<string>(TRANSACTION_TYPES);
const ALLOWED_STATUSES = new Set(['all', 'completed', 'processing', 'pending', 'failed']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/;
const MIN_RANGE_DATE = '1970-01-01';
const MAX_RANGE_DATE = '2100-12-31';

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
  if (filters.from ?? filters.fromDate) params.set('from', filters.from ?? filters.fromDate ?? '');
  if (filters.to ?? filters.toDate) params.set('to', filters.to ?? filters.toDate ?? '');

  return params;
}

function asDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

function clampDate(value: string): string {
  const dateOnly = value.slice(0, 10);
  if (dateOnly < MIN_RANGE_DATE) return MIN_RANGE_DATE;
  if (dateOnly > MAX_RANGE_DATE) return MAX_RANGE_DATE;
  return value;
}

function parseRangeDate(
  params: URLSearchParams,
  primaryName: 'from' | 'to',
  legacyName: 'fromDate' | 'toDate',
): { value?: string; error?: string } {
  const usedName = params.has(primaryName) ? primaryName : legacyName;
  const value = params.get(primaryName) ?? params.get(legacyName);
  if (!value) return {};

  if (!ISO_DATE_RE.test(value)) {
    return { error: `Invalid ${usedName}: ${value}` };
  }

  const date = asDate(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `Invalid ${usedName}: ${value}` };
  }

  return { value: clampDate(value) };
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

    if (normalizedStatus === 'all') filter.status = 'All';
    else if (normalizedStatus === 'completed') filter.status = 'Completed';
    else if (normalizedStatus === 'processing' || normalizedStatus === 'pending') filter.status = 'Processing';
    else filter.status = 'Failed';
  }

  const asset = params.get('asset');
  if (asset) {
    if (!/^[A-Za-z0-9]{1,12}$/.test(asset)) {
      return { valid: false, filter, error: `Invalid asset: ${asset}` };
    }
    filter.asset = asset.toUpperCase();
  }

  const fromDate = parseRangeDate(params, 'from', 'fromDate');
  if (fromDate.error) {
    return { valid: false, filter, error: fromDate.error };
  }

  const toDate = parseRangeDate(params, 'to', 'toDate');
  if (toDate.error) {
    return { valid: false, filter, error: toDate.error };
  }

  if (fromDate.value) {
    filter.from = fromDate.value;
    filter.fromDate = fromDate.value;
  }

  if (toDate.value) {
    filter.to = toDate.value;
    filter.toDate = toDate.value;
  }

  if (fromDate.value && toDate.value && asDate(fromDate.value) > asDate(toDate.value)) {
    return { valid: false, filter, error: 'Invalid date range: from must be before or equal to to' };
  }

  return { valid: true, filter };
}
