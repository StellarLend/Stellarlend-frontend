import type { MarketsResponse } from '@/lib/markets/types';

const MARKET_API_URL = '/api/markets';
const MARKET_RESPONSE_TTL_MS = 30 * 1000;

let cachedMarketsResponse: MarketsResponse | null = null;
let cacheTimestamp = 0;
let pendingMarketsFetch: Promise<MarketsResponse> | null = null;

export function clearMarketsResponseCache() {
  cachedMarketsResponse = null;
  cacheTimestamp = 0;
  pendingMarketsFetch = null;
}

export async function getMarketsResponse(): Promise<MarketsResponse> {
  const now = Date.now();

  if (cachedMarketsResponse && now - cacheTimestamp < MARKET_RESPONSE_TTL_MS) {
    return cachedMarketsResponse;
  }

  if (pendingMarketsFetch) {
    return pendingMarketsFetch;
  }

  pendingMarketsFetch = fetch(MARKET_API_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Markets request failed with status ${response.status}`);
    }

    const data = (await response.json()) as MarketsResponse;
    cachedMarketsResponse = data;
    cacheTimestamp = Date.now();
    return data;
  });

  try {
    return await pendingMarketsFetch;
  } finally {
    pendingMarketsFetch = null;
  }
}
