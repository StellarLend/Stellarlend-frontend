"use client";

import { useEffect, useRef, useState } from "react";
import {
  TX_API_STATUS,
  TX_HOOK_STATE,
  TX_STATUS_ENDPOINT,
  TX_STATUS_POLL,
  isTerminalApiStatus,
} from "./constants";

export type TxStatus =
  | { state: typeof TX_HOOK_STATE.PROCESSING }
  | { state: typeof TX_HOOK_STATE.COMPLETED; result: unknown }
  | { state: typeof TX_HOOK_STATE.FAILED; error?: unknown }
  | { state: typeof TX_HOOK_STATE.RATE_LIMITED; retryAfterSeconds?: number };

export default function useTxStatus(hash: string | null) {
  const [status, setStatus] = useState<TxStatus | null>(null);
  const mounted = useRef(true);
  const abortCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortCtrl.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!hash) return;

    let delay = TX_STATUS_POLL.INITIAL_DELAY_MS;
    let stopped = false;

    const poll = async () => {
      if (!mounted.current || stopped) return;
      abortCtrl.current = new AbortController();
      try {
        setStatus({ state: TX_HOOK_STATE.PROCESSING });
        const res = await fetch(TX_STATUS_ENDPOINT(hash), {
          signal: abortCtrl.current.signal,
        });

        if (res.status === 429) {
          const retry = res.headers.get("Retry-After");
          const retryAfterSeconds = retry ? Number(retry) : undefined;
          setStatus({ state: TX_HOOK_STATE.RATE_LIMITED, retryAfterSeconds });
          stopped = true;
          return;
        }

        const json = await res.json();
        const apiStatus = (json && json.status) || null;

        if (apiStatus === TX_API_STATUS.SUCCESS) {
          setStatus({ state: TX_HOOK_STATE.COMPLETED, result: json });
          stopped = true;
          return;
        }

        if (isTerminalApiStatus(apiStatus) && apiStatus !== TX_API_STATUS.SUCCESS) {
          setStatus({ state: TX_HOOK_STATE.FAILED, error: json });
          stopped = true;
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(
          TX_STATUS_POLL.MAX_DELAY_MS,
          delay * TX_STATUS_POLL.BACKOFF_MULTIPLIER,
        );
        if (!stopped) poll();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(
          TX_STATUS_POLL.MAX_DELAY_MS,
          delay * TX_STATUS_POLL.BACKOFF_MULTIPLIER,
        );
        if (!stopped) poll();
      }
    };

    poll();

    return () => {
      stopped = true;
      abortCtrl.current?.abort();
    };
  }, [hash]);

  return status;
}
