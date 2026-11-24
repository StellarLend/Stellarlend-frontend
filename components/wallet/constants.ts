/**
 * Storage keys used across wallet modules.
 * Centralised here so every module imports from one place.
 */
export const LAST_WALLET_STORAGE_KEY = "stellarlend:last_wallet_id";
export const AUTOCONNECT_STORAGE_KEY = "stellarlend.wallet.autoconnect";

export function getAutoConnectFlag(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return window.localStorage.getItem(AUTOCONNECT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAutoConnectFlag(enabled: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (enabled) {
      window.localStorage.setItem(AUTOCONNECT_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(AUTOCONNECT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failure (e.g. Safari private browsing restrictions)
  }
}
