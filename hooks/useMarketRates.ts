import { useEffect, useState } from "react";
import { getMarketsResponse } from "./useMarketsData";

export interface UseMarketRatesResult {
  rate: number | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  source: string | null;
}

export function useMarketRates(asset?: string | null): UseMarketRatesResult {
  const [rate, setRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const normalizedAsset = asset?.trim().toUpperCase();

    if (!normalizedAsset) {
      setRate(null);
      setError(null);
      setLastUpdated(null);
      setSource(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    setIsLoading(true);
    setError(null);
    setRate(null);
    setLastUpdated(null);
    setSource(null);

    getMarketsResponse()
      .then((data) => {
        if (isCancelled) {
          return;
        }

        const market = data.markets.find(
          (entry) => entry.asset.toUpperCase() === normalizedAsset,
        );

        if (!market || typeof market.borrowApr !== "number") {
          setError(`No borrow rate available for ${normalizedAsset}`);
          setRate(null);
          setLastUpdated(data.timestamp ?? null);
          setSource(data.source ?? null);
          return;
        }

        setRate(market.borrowApr);
        setLastUpdated(data.timestamp ?? null);
        setSource(data.source ?? null);
      })
      .catch((fetchError) => {
        if (isCancelled) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to read market rates";

        setError(message);
        setRate(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [asset]);

  return { rate, isLoading, error, lastUpdated, source };
}
