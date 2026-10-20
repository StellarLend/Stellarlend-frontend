/**
 * lib/csp.ts — Pure Content-Security-Policy builder.
 *
 * Used by middleware.ts to generate a per-request nonce-based CSP.
 * Pure function with zero side-effects; all configuration is passed as params.
 */

export type CspOptions = {
  /** Per-request nonce (base64 string, generated in middleware) */
  nonce: string;
  /** Horizon endpoint URL (e.g. https://horizon-testnet.stellar.org) */
  horizon: string;
  /** Soroban RPC endpoint URL (e.g. https://soroban-testnet.stellar.org) */
  rpc: string;
  /** True in development — adds 'unsafe-eval' for React fast-refresh */
  dev?: boolean;
  /** Optional report-uri endpoint for CSP violation reports */
  reportUri?: string;
};

/**
 * Extract the scheme+host+port (origin) from a URL string.
 * Returns null for empty, invalid, or non-https (in prod) URLs.
 * Throws on malformed URLs so build fails loudly rather than silently
 * producing a permissive policy.
 */
export function extractOrigin(url: string, dev = false): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `[CSP] Invalid URL in configuration: "${trimmed}". ` +
        "Set NEXT_PUBLIC_HORIZON_URL and NEXT_PUBLIC_SOROBAN_RPC_URL to valid URLs."
    );
  }

  // In production, require https (or http://localhost for local dev overrides)
  if (!dev && parsed.protocol !== "https:") {
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(
        `[CSP] Non-HTTPS origin in production config: "${trimmed}". ` +
          "All external endpoints must use HTTPS."
      );
    }
  }

  // Return origin (scheme + host + optional port)
  return parsed.origin;
}

/**
 * Build the Content-Security-Policy header value.
 *
 * Directives:
 * - script-src:  'self' + nonce + 'strict-dynamic' (no eval in prod)
 * - style-src:   'self' 'unsafe-inline' (required for Tailwind class generation)
 * - connect-src: 'self' + Horizon + RPC origins
 * - img-src:     'self' data: blob: (blob: for wallet icons)
 * - font-src:    'self' data:
 * - frame-ancestors: 'none' (anti-clickjacking)
 * - base-uri:    'self'
 * - form-action: 'self'
 * - object-src:  'none'
 * - upgrade-insecure-requests (production only)
 */
export function buildCsp(opts: CspOptions): string {
  const { nonce, horizon, rpc, dev = false, reportUri } = opts;

  const horizonOrigin = extractOrigin(horizon, dev);
  const rpcOrigin = extractOrigin(rpc, dev);

  // Deduplicate origins in connect-src
  const connectSrcSet = new Set(["'self'"]);
  if (horizonOrigin) connectSrcSet.add(horizonOrigin);
  if (rpcOrigin) connectSrcSet.add(rpcOrigin);
  const connectSrc = [...connectSrcSet].join(" ");

  // script-src: nonce + strict-dynamic allows scripts loaded by trusted scripts
  // without listing each hash. unsafe-eval only in dev for React fast refresh.
  const scriptSrcParts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (dev) scriptSrcParts.push("'unsafe-eval'");
  const scriptSrc = scriptSrcParts.join(" ");

  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", scriptSrc],
    ["style-src", "'self' 'unsafe-inline'"],
    ["connect-src", connectSrc],
    ["img-src", "'self' data: blob:"],
    ["font-src", "'self' data:"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["object-src", "'none'"],
    ["worker-src", "'self' blob:"],
  ];

  if (!dev) {
    directives.push(["upgrade-insecure-requests", ""]);
  }

  if (reportUri) {
    directives.push(["report-uri", reportUri]);
  }

  return directives
    .map(([name, value]) => (value ? `${name} ${value}` : name))
    .join("; ");
}
