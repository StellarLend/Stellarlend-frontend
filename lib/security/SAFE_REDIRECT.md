# Safe Redirect Validation

Validates redirect targets used after wallet connect and logout to prevent
open-redirect attacks where an attacker crafts a URL with an external or
malicious `returnUrl` parameter.

## Architecture

To find the core validation logic visit
[safe-redirect.ts](safe-redirect.ts).

The helper `safeRedirectPath()` accepts a raw redirect candidate string from
any source (URL query parameter, API response, cookie) and returns either
the validated internal path or the safe default `/`.

### Allowlist

Only paths matching these prefixes are honoured:

- `/` — home page
- `/dashboard` — main dashboard
- `/lending` — lending & borrowing views
- `/account` — account settings, profile, notifications

### Rejected

- Absolute URLs (`https://evil.com`, `http://192.168...`)
- Protocol-relative URLs (`//evil.com`)
- Dangerous schemes (`javascript:`, `data:`, `vbscript:`)
- Whitespace padding on dangerous schemes
- Unknown or unlisted internal paths
- Encoded variants of all the above

### Decoding

The helper decodes the raw value via `decodeURIComponent` before validation
so encoded attacks (`%2F%2Fevil.com`, `javascript%3A...`) are caught. Invalid
encoding (throwing on decode) also defaults to `/`.

## Integration Points

### Wallet connect

After a successful wallet connection in
[context/WalletContext.tsx](../../context/WalletContext.tsx) and
[hooks/useWallet.tsx](../../hooks/useWallet.tsx), the `connect()` function
reads `returnUrl` from the current page's URL search params, validates it
through `safeRedirectPath()`, and navigates to the safe result if present.

### Logout / disconnect

After a successful disconnect, the `disconnect()` function reads `returnUrl`
from the page URL, validates it, and navigates.

### Server-side (defence in depth)

The logout API route at
[app/api/auth/logout/route.ts](../../app/api/auth/logout/route.ts) also
validates any `returnUrl` query parameter server-side so that even if
someone calls the endpoint directly with a crafted parameter, the response
only contains a safe `redirectTo` value.

## Usage

```ts
import { safeRedirectPath } from '@/lib/security/safe-redirect';

// Client-side (after connect / disconnect)
const returnUrl = new URL(window.location.href).searchParams.get('returnUrl');
if (returnUrl) {
  const target = safeRedirectPath(returnUrl);
  router.push(target);
}
```
