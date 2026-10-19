/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Static security headers applied to every route.
   *
   * These complement the nonce-based CSP set by middleware.ts:
   * - middleware handles the dynamic, per-request CSP for HTML pages
   * - headers() here handles static assets and provides belt-and-suspenders
   *   coverage for any route the middleware matcher misses
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          {
            // HTTP Strict Transport Security — 2 years, include subdomains, preload-eligible
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Belt-and-suspenders: duplicate of middleware but caught by
            // static-file handlers that bypass edge middleware
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Deny all browser APIs this dapp does not use
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          {
            // Disable DNS prefetching of links on the page to reduce
            // information leakage and improve privacy
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
