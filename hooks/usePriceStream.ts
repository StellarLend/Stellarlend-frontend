import { useEffect, useRef, useState, useCallback } from "react";
import type { SupportedAsset } from "@/lib/prices/types";

export type PriceDirection = "up" | "down" | "unchanged";

export interface PricedAsset {
  symbol: SupportedAsset;
  price: number;
  direction: PriceDirection;
  timestamp: string;
}

function isValidPriceUpdate(value: unknown): value is {
  symbol: SupportedAsset;
  price: number;
  timestamp: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const update = value as Partial<{
    symbol: unknown;
    price: unknown;
    timestamp: unknown;
  }>;

  if (typeof update.symbol !== "string") {
    return false;
  }

  if (typeof update.price !== "number" || !Number.isFinite(update.price)) {
    return false;
  }

  if (typeof update.timestamp !== "string") {
    return false;
  }

  return true;
}

function parseEventData(event: MessageEvent): unknown {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export interface UsePriceStreamOptions {
  onPrice?: (prices: Map<SupportedAsset, PricedAsset>) => void;
}

function usePriceStream(options: UsePriceStreamOptions = {}) {
  const [prices, setPrices] = useState<Map<SupportedAsset, PricedAsset>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(1000);
  const previousPricesRef = useRef<Map<SupportedAsset, number>>(new Map());
  const onPriceRef = useRef(options.onPrice);

  useEffect(() => {
    onPriceRef.current = options.onPrice;
  }, [options.onPrice]);

  const cleanup = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      return;
    }

    const source = new EventSource("/api/stream/prices");
    sourceRef.current = source;

    source.onopen = () => {
      backoffRef.current = 1000;
    };

    source.onmessage = (event: MessageEvent) => {
      const data = parseEventData(event);

      if (!isValidPriceUpdate(data)) {
        return;
      }

      setPrices((prev) => {
        const previousPrice = previousPricesRef.current.get(data.symbol);

        const direction: PriceDirection =
          previousPrice === undefined
            ? "unchanged"
            : data.price > previousPrice
              ? "up"
              : data.price < previousPrice
                ? "down"
                : "unchanged";

        previousPricesRef.current.set(data.symbol, data.price);

        const newPrices = new Map(prev);
        newPrices.set(data.symbol, {
          symbol: data.symbol,
          price: data.price,
          direction,
          timestamp: data.timestamp,
        });

        onPriceRef.current?.(newPrices);
        setIsLoading(false);

        return new Map(newPrices);
      });
    };

    source.onerror = () => {
      cleanup();

      reconnectTimeoutRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
        connect();
      }, backoffRef.current);
    };
  }, [cleanup]);

  useEffect(() => {
    connect();
    return () => cleanup();
  }, [connect, cleanup]);

  return { prices, isLoading };
}

export default usePriceStream;