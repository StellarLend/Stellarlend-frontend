import type { Transaction } from '@/types/Transaction';
import type { AssetSymbol, TransactionType, TransactionStatus } from '@/types/enums';
import { ASSET_SYMBOLS } from '@/types/enums';
import type { HorizonOperation } from './types';

function resolveAsset(assetType?: string, assetCode?: string): AssetSymbol | null {
  if (assetType === 'native') return 'XLM';
  if (!assetCode) return null;
  const upper = assetCode.toUpperCase() as AssetSymbol;
  return (ASSET_SYMBOLS as readonly string[]).includes(upper) ? upper : null;
}

function parseAmount(raw?: string): number | null {
  if (raw === undefined || raw === null) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function formatDateParts(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toISOString().slice(0, 10);

  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const time = `${String(hours).padStart(2, '0')}:${minutes}${meridiem}`;

  return { date, time };
}

function resolveStatus(successful: boolean): TransactionStatus {
  return successful ? 'Completed' : 'Failed';
}

/**
 * Maps a single Horizon operation to the internal Transaction shape.
 *
 * Returns null for operation types that have no Transaction equivalent
 * (e.g. manage_offer, change_trust, set_options) or when required fields
 * such as asset or amount are missing / unsupported.
 *
 * Amount sign convention:
 *   positive  → funds received by the account (Deposit)
 *   negative  → funds sent from the account (Withdrawal)
 */
export function normalizeOperation(
  op: HorizonOperation,
  accountId: string,
): Transaction | null {
  const { date, time } = formatDateParts(op.created_at);
  const status = resolveStatus(op.transaction_successful);

  if (op.type === 'payment') {
    const asset = resolveAsset(op.asset_type, op.asset_code);
    if (!asset) return null;

    const raw = parseAmount(op.amount);
    if (raw === null || raw === 0) return null;

    const isIncoming = op.to === accountId;
    const type: TransactionType = isIncoming ? 'Deposit' : 'Withdrawal';
    const amount = isIncoming ? raw : -raw;

    return { id: op.id, type, amount, asset, date, time, status };
  }

  if (op.type === 'create_account') {
    const raw = parseAmount(op.starting_balance);
    if (raw === null || raw === 0) return null;

    const isIncoming = op.account === accountId;
    const type: TransactionType = isIncoming ? 'Deposit' : 'Withdrawal';
    const amount = isIncoming ? raw : -raw;

    return { id: op.id, type, amount, asset: 'XLM', date, time, status };
  }

  if (
    op.type === 'path_payment_strict_send' ||
    op.type === 'path_payment_strict_receive'
  ) {
    const isIncoming = op.to === accountId;

    const assetType = isIncoming ? op.asset_type : op.source_asset_type;
    const assetCode = isIncoming ? op.asset_code : op.source_asset_code;
    const asset = resolveAsset(assetType, assetCode);
    if (!asset) return null;

    const rawStr = isIncoming
      ? (op.destination_amount ?? op.amount)
      : (op.source_amount ?? op.amount);
    const raw = parseAmount(rawStr);
    if (raw === null || raw === 0) return null;

    const type: TransactionType = isIncoming ? 'Deposit' : 'Withdrawal';
    const amount = isIncoming ? raw : -raw;

    return { id: op.id, type, amount, asset, date, time, status };
  }

  return null;
}

/**
 * Normalizes a batch of Horizon operations for the given account.
 * Operations that cannot be mapped are silently dropped.
 */
export function normalizeOperations(
  operations: HorizonOperation[],
  accountId: string,
): Transaction[] {
  const result: Transaction[] = [];
  for (const op of operations) {
    const tx = normalizeOperation(op, accountId);
    if (tx !== null) result.push(tx);
  }
  return result;
}
