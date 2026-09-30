# Client log redaction

Client-side logging now routes through the shared client log wrapper in [lib/utils/client-log.ts](lib/utils/client-log.ts).

The wrapper:
- masks Stellar addresses with a prefix/suffix pattern
- redacts known sensitive keys such as `walletAddress`, `amount`, `balance`, and `fee`
- no-ops in production or when `NEXT_PUBLIC_DISABLE_CLIENT_LOGS=true`
- leaves safe values unchanged
