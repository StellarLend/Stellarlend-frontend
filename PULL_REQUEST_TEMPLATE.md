## Summary

Adds a dedicated unit test suite for `context/WalletContext.tsx`, covering the provider's full state machine: connect/disconnect transitions, network state resolution, session persistence rehydration, consumer re-renders, and the hook guard.

## Changes

### New Files

- **`context/WalletContext.test.tsx`** — 23 test cases organized into 7 `describe` blocks
- **`context/WALLET_CONTEXT_TESTS.md`** — Test plan documentation for reviewers

### Modified Files

- **`vitest.config.ts`** — Added `context/**/*.test.{ts,tsx}` to the `accessibility` project's include patterns so the new test file is discovered by `vitest`

## Test Coverage

| Category | Tests | What's Covered |
|---|---|---|
| Initial state | 2 | Starts disconnected, null address, null error; network derived from config |
| Rehydration | 6 | sessionStorage restore, server session restore, sessionStorage priority, server clearing stale state, fetch failure, network error tolerance |
| Connect | 6 | Full success flow, Freighter missing, null pubkey, challenge API failure, verify API failure, error cleared on retry |
| Disconnect | 3 | Connected→disconnected, server DELETE failure (local state still cleared), no-op when already disconnected |
| Network state | 3 | `TESTNET` for testnet, `PUBLIC` for mainnet, `PUBLIC` for PUBLIC string |
| Consumer re-renders | 2 | Spy assertions verify consumers re-render with correct values on connect and disconnect |
| Hook guard | 1 | `useWalletContext` throws outside `WalletProvider` |

## Verification

```bash
# Run just the new tests
npx vitest run --project accessibility context/WalletContext

# Expected output: 23 passed, 0 failed
```

All 23 tests pass deterministically. The suite uses DOM-based rendering with `data-testid` attributes for state assertions and wraps async transitions in `act()` with `waitFor` polling for stability.

## Edge Cases Covered

- Connect failure when `window.stellar` is absent vs. when it returns invalid data
- Disconnect when the server DELETE request fails (network error)
- Disconnect when the user is already disconnected
- Rehydration race condition where sessionStorage has data but the server returns no session
- Network error during rehydration (server unreachable)
- Switching from error state back to connected on a subsequent attempt
- Environment override for `NEXT_PUBLIC_STELLAR_NETWORK` (mainnet/PUBLIC)

## Notes

- Uses `@testing-library/react` `render` + `act` instead of `renderHook` for connect/disconnect interaction tests, as React 19's batching in `renderHook` doesn't reliably flush synchronous-throw state updates inside async `act` callbacks
- Existing `hooks/useWallet.test.tsx` has rotted (broken imports, stale error messages) and continues to fail independently — these are pre-existing issues unrelated to this PR
