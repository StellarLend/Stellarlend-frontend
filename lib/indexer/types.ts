export type HorizonOperationType =
  | 'create_account'
  | 'payment'
  | 'path_payment_strict_receive'
  | 'path_payment_strict_send'
  | 'manage_sell_offer'
  | 'create_passive_sell_offer'
  | 'set_options'
  | 'change_trust'
  | 'allow_trust'
  | 'account_merge'
  | 'manage_data'
  | 'bump_sequence'
  | 'manage_buy_offer'
  | 'create_claimable_balance'
  | 'claim_claimable_balance'
  | 'begin_sponsoring_future_reserves'
  | 'end_sponsoring_future_reserves'
  | 'revoke_sponsorship'
  | 'clawback'
  | 'clawback_claimable_balance'
  | 'set_trust_line_flags'
  | 'liquidity_pool_deposit'
  | 'liquidity_pool_withdraw'
  | 'invoke_host_function'
  | 'extend_footprint_ttl'
  | 'restore_footprint';

export interface HorizonOperation {
  id: string;
  type: HorizonOperationType;
  created_at: string;
  transaction_successful: boolean;
  // payment / path_payment fields
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  source_amount?: string;
  source_asset_type?: string;
  source_asset_code?: string;
  destination_amount?: string;
  destination_asset_type?: string;
  destination_asset_code?: string;
  // create_account fields
  starting_balance?: string;
  funder?: string;
  account?: string;
}

export interface HorizonPage {
  _embedded: {
    records: HorizonOperation[];
  };
  _links: {
    next?: { href: string };
    prev?: { href: string };
    self: { href: string };
  };
}

export interface IndexerOptions {
  /** Max records per Horizon page request (1–200, default 200). */
  limit?: number;
  /** Sort order for operations (default 'desc'). */
  order?: 'asc' | 'desc';
  /** Horizon paging cursor to start from. */
  cursor?: string;
  /** Maximum number of pages to fetch per call (default 5). */
  maxPages?: number;
  /** Per-request timeout in milliseconds (default 8 000). */
  timeoutMs?: number;
}
