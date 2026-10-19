/**
 * middleware.ts — Next.js Edge Middleware for security headers.
 *
 * Runs on every HTML request. Injects:
 * - Content-Security-Policy (nonce-based, per-request)
 * - X-Content-Type-Options
 * - X-Frame-Options (belt-and-suspenders alongside CSP frame-ancestors)
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * HSTS and X-Content-Type-Options are also set in next.config.mjs headers()
 * for static asset responses; middleware handles the dynamic HTML pages.
 */
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

// Middleware runs on the Edge runtime by default in Next.js 15; exporting
// `runtime = "edge"` here makes `next build` fail, so it is left implicit.

export function middleware(request: NextRequest): NextResponse {
  // Generate a cryptographically random nonce for this request.
  // We use 128 bits of randomness, base64url-encoded.
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const dev = process.env.NODE_ENV === "development";
  const horizon =
    process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
  const rpc =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
  const reportUri = process.env.NEXT_PUBLIC_CSP_REPORT_URI;

  let csp: string;
  try {
    csp = buildCsp({ nonce, horizon, rpc, dev, reportUri });
  } catch (err) {
    // Misconfigured URL — fail loudly in development, use a safe fallback in prod.
    if (dev) throw err;
    console.error("[CSP] Config error — falling back to safe defaults:", err);
    csp = buildCsp({
      nonce,
      horizon: "https://horizon-testnet.stellar.org",
      rpc: "https://soroban-testnet.stellar.org",
      dev: false,
    });
  }

  // Forward the CSP and nonce on the request so Next.js stamps the nonce onto
  // the framework <script> tags it renders (required with 'strict-dynamic').
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Content-Security-Policy
  response.headers.set("Content-Security-Policy", csp);

  // Expose the nonce to the app so layout.tsx can pass it to <Script> tags.
  // The CSP_NONCE header is read in app/layout.tsx via headers().
  response.headers.set("x-nonce", nonce);

  // Belt-and-suspenders anti-framing (complements CSP frame-ancestors)
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Limit referrer information sent on navigation
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy: disable sensors/camera/mic that this dapp never uses
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );

  return response;
}

// Only apply middleware to HTML pages — skip static assets, API routes, etc.
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico, icon.svg, robots.txt, sitemap.xml
     * - public asset files (images, icons, svgs)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)).*)",
  ],
};
