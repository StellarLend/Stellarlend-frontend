# Client Secret Boundary Contract

This document defines the supported security contract for `scripts/check-client-secrets.js`, `scripts/check-bundle-secrets.ts`, and `middleware.ts`.

## Invariants

- `NEXT_PUBLIC_*` values are the only environment configuration intended for browser code.
- Server-only environment variables must not be referenced from client/shared source.
- Server configuration modules must not be imported, required, or dynamically imported by client/shared code.
- The bundle scanner must fail closed when `.next/static` is absent or a bundle cannot be read.
- Critical/high bundle findings fail the build; medium findings are observable warnings.
- Scanner diagnostics identify the pattern and source location but never print the complete matched secret.
- Anonymous middleware rate-limit keys are bounded and derived from a syntactically valid first forwarded address; malformed or oversized input uses a stable fallback bucket.
- Authentication and health-check exemptions preserve their existing behavior while retaining request/security headers.
- Rate-limit rejection responses remain `429` and expose `Retry-After`, rate-limit metadata, CSP, Referrer-Policy, and a request ID.

## Failure and recovery behavior

| Boundary | Normal | Failure | Recovery |
| --- | --- | --- | --- |
| Source scanner | no forbidden references | non-zero exit | remove server-only access/import and rerun |
| Bundle scanner | build output exists and is readable | non-zero exit for missing/unreadable output or critical/high finding | rebuild after remediation |
| Middleware | valid anonymous identity or authenticated request | bounded fallback identity or `429` quota response | retry after advertised reset window |

## Compatibility

The scanner entry points remain executable from the existing npm scripts. The middleware continues to export `middleware` and `config`, and existing rate-limit response headers are preserved. The new scanner helpers are additive exports used by focused tests.

## Accessibility

The three implementation boundaries are build/runtime security utilities and middleware; they do not render interactive UI. Keyboard, focus, screen-reader, responsive-layout, and reduced-motion behavior are therefore not applicable to this feature. No UI surface is changed to manufacture an accessibility dependency.

## Validation

Recommended focused checks:

```bash
npm test -- scripts/__tests__/check-client-secrets.test.ts
npm test -- scripts/__tests__/check-bundle-secrets.test.ts
npm test -- __tests__/middleware.security.test.ts
npm run check-secrets
npm run check-bundle-secrets
npm run type-check
npm run build
```

## Tradeoffs and limitations

The forwarded-address validation is intentionally syntactic rather than a full proxy-trust policy. Deployments should still configure trusted reverse proxies correctly. The fallback bucket prevents attacker-controlled unbounded keys but can group malformed requests together. Bundle scanning remains a defense-in-depth control and cannot replace correct server/client module boundaries.
