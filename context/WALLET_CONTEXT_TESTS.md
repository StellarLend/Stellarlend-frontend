# WalletContext Test Plan

## Overview

Test suite for `context/WalletContext.tsx` — the React context provider that manages wallet connection state, network detection, and session persistence.

## Coverage Areas

### 1. Initial State (`describe("initial state")`)
- Starts `disconnected` with `null` address and `null` error
- Derives network from config (`TESTNET` for testnet env)

### 2. Rehydration (`describe("rehydration")`)
- Restores address/status from `sessionStorage` on mount
- Restores address/status from server `/api/auth/session` on mount
- Prefers `sessionStorage` over server when both are present
- Clears state when the server returns no session
- Clears state when the session fetch fails (non-ok response)
- Handles network errors during rehydration gracefully (keeps existing sessionStorage state)

### 3. Connect (`describe("connect")`)
- Full success flow: disconnected → connected, address persisted in sessionStorage
- Error when Freighter (`window.stellar`) is not detected — status set to `error`
- Error when `getPublicKey` returns null — status set to `error`
- Error when `/api/auth/challenge` returns non-ok — status set to `error`
- Error when `/api/auth/verify` returns non-ok — status set to `error`
- Clears previous error on a subsequent successful connect attempt

### 4. Disconnect (`describe("disconnect")`)
- Transitions from connected → disconnected, clears sessionStorage
- Clears local state even when the server DELETE call fails
- Works as a no-op when already disconnected

### 5. Network State (`describe("network state")`)
- Resolves `TESTNET` for `testnet` config
- Resolves `PUBLIC` for `mainnet` config
- Resolves `PUBLIC` for `PUBLIC` config string

### 6. Consumer Re-renders (`describe("consumer re-renders on state change")`)
- Consumers re-render with updated values when connect succeeds
- Consumers re-render with updated values when disconnect completes

### 7. Hook Guard (`describe("useWalletContext")`)
- `useWalletContext()` throws when called outside a `WalletProvider`

## Test Strategy

- DOM-based testing: renders a `Harness` component with connect/disconnect buttons and data-testid attributes for assertions
- `renderHook` used for initial state, rehydration, and network state tests (sync reads)
- All async state transitions wrapped in `act()`; DOM assertions use `waitFor` for stability
- `vi.mocked(fetch)` chains sequential mock responses for rehydration, challenge, verify, and session DELETE calls
- `window.stellar` mock controls Freighter availability

## Running

```bash
# Run just the WalletContext tests
npx vitest run --project accessibility context/WalletContext

# Run the full accessibility test suite
npx vitest run --project accessibility
```
