"use client";

import { useEffect, useRef, useState } from "react";

export type TxStatus =
  | { state: "processing" }
  | { state: "completed"; result: any }
  | { state: "failed"; error?: any }
  | { state: "rate_limited"; retryAfterSeconds?: number };

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

    let attempts = 0;
    let delay = 1000; // 1s
    let stopped = false;

    const poll = async () => {
      if (!mounted.current || stopped) return;
      attempts += 1;
      abortCtrl.current = new AbortController();
      try {
        setStatus({ state: "processing" });
        const res = await fetch(`/api/tx/status/${hash}`, { signal: abortCtrl.current.signal });

        if (res.status === 429) {
          const retry = res.headers.get("Retry-After");
          const retryAfterSeconds = retry ? Number(retry) : undefined;
          setStatus({ state: "rate_limited", retryAfterSeconds });
          stopped = true;
          return;
        }

        const json = await res.json();
        const apiStatus = (json && json.status) || null;

        if (apiStatus === "SUCCESS") {
          setStatus({ state: "completed", result: json });
          stopped = true;
          return;
        }

        if (apiStatus === "FAILED" || apiStatus === "NOT_FOUND") {
          setStatus({ state: "failed", error: json });
          stopped = true;
          return;
        }

        // otherwise keep polling with backoff
        attempts += 0;
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(30000, delay * 2);
        if (!stopped) poll();
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        // transient network error: backoff and retry
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(30000, delay * 2);
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
