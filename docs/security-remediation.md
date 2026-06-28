# Dependency Vulnerability Remediation Flow

Our pipeline validates dependencies against known issues using `pnpm audit` and `osv-scanner`. If a build fails due to an advisory:

1. **Locate the Failure**: Review the GitHub Actions console log to find the offending package name and vulnerability ID (CVE/GHSA).
2. **Attempt Remediation**: Run `pnpm update <package-name> --latest` to pull a patched version.
3. **Apply Exception Waiver**: If a fix is unavailable and the risk is analyzed as non-exploitable, document it inside `.security/waivers.yml` and add the corresponding ID to `.security/osv-config.toml`.

## Rendering Untrusted On-Chain Data

All on-chain transaction data, such as memos and hashes, are considered attacker-controllable input.
When displaying memos or rendering explorer links:
1. Memos must be treated as inert text. Never render them using `dangerouslySetInnerHTML`.
2. Any control characters must be stripped using the sanitization helper `sanitiseString` from `lib/security/input-sanitizer.ts`.
3. Outbound explorer URLs must be built from a validated transaction hash and a fixed allowlisted base (such as `https://stellar.expert/explorer/...`). The transaction hash must be validated, and any URL prefix must be strictly restricted to safe `https` origins.
4. Always specify `rel="noopener noreferrer"` for external anchors.

## Internal Cache Invalidation Route

`app/api/internal/cache/invalidate/route.ts` is a server-only deployment hook for
targeted cache busting. It must stay narrow because a public caller that can
invalidate namespaces repeatedly can force cache stampedes against upstream
services.

The route applies three checks before parsing the request body:

1. The request method must be `POST`.
2. The `Authorization` header must be `Bearer <SERVER_TOKEN>`, compared with a
   timing-safe equality check.
3. If an `Origin` header is present, it must match one of the comma-separated
   `CACHE_INVALIDATE_ALLOWED_ORIGINS` entries from `lib/server-config.ts`.

Requests that fail any guard return the same `{ "error": "Unauthorized" }`
envelope so callers cannot distinguish whether the token, method, or origin
check failed. Server-to-server callers may omit `Origin`; browser-originated
calls must be explicitly allowlisted.
