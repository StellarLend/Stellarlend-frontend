import { config } from "./config";

export interface FriendbotResult {
  ok: boolean;
  status: "success" | "already_funded" | "error";
  message?: string;
}

/**
 * Request testnet lumens for an address from Friendbot.
 * Only executes when config.network is "testnet".
 * Treats 400 op_already_exists / createAccountAlreadyExist as already funded.
 */
export async function fundWithFriendbot(
  address: string,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<FriendbotResult> {
  if (config.network !== "testnet") {
    return {
      ok: false,
      status: "error",
      message: "Friendbot is only available on Stellar testnet.",
    };
  }

  if (!address || typeof address !== "string" || !address.trim()) {
    return {
      ok: false,
      status: "error",
      message: "A valid Stellar address is required.",
    };
  }

  const timeoutMs = options?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If caller provided an abort signal, listen to it
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      return { ok: false, status: "error", message: "Request aborted." };
    }
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(address.trim())}`;
    const res = await fetch(url, { signal: controller.signal });

    if (res.ok) {
      return { ok: true, status: "success" };
    }

    if (res.status === 400) {
      const text = await res.text().catch(() => "");
      if (
        text.includes("op_already_exists") ||
        text.includes("createAccountAlreadyExist") ||
        text.includes("already exists")
      ) {
        return { ok: true, status: "already_funded" };
      }
      return {
        ok: false,
        status: "error",
        message: text || "Friendbot returned 400 Bad Request.",
      };
    }

    return {
      ok: false,
      status: "error",
      message: `Friendbot returned error ${res.status}: ${res.statusText}`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        status: "error",
        message: "Request timed out waiting for Friendbot.",
      };
    }
    return {
      ok: false,
      status: "error",
      message: err instanceof Error ? err.message : "Failed to connect to Friendbot.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Poll Horizon until the given address exists and is funded.
 * Polling stops if signal is aborted or max timeout is reached.
 */
export async function pollUntilFunded(
  address: string,
  options?: {
    maxWaitMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
  }
): Promise<boolean> {
  const maxWaitMs = options?.maxWaitMs ?? 20000;
  const intervalMs = options?.intervalMs ?? 1500;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    if (options?.signal?.aborted) {
      return false;
    }

    try {
      const res = await fetch(`${config.horizon}/accounts/${encodeURIComponent(address)}`, {
        signal: options?.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const native = data?.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
        if (native && Number(native.balance) > 0) {
          return true;
        }
      }
    } catch {
      // transient network error while polling, continue until timeout
    }

    if (Date.now() - startTime + intervalMs >= maxWaitMs) {
      break;
    }

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      if (options?.signal) {
        options.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
      }
    });
  }

  return false;
}
