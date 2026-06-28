# Wallet Context & useWallet Hook Documentation

## Overview

The `WalletContext` provider and `useWallet` hook supply a single client-side source of truth for the connected Stellar wallet's state. It coordinates with Freighter (or other injected window-based Stellar wallet providers), triggers the challenge-response authentication flow, sets local and secure cookie sessions, and rehydrates connection state upon page reloads.

## Directory Structure
- Context Provider: `context/WalletContext.tsx`
- Custom Hook: `hooks/useWallet.ts`
- Usage Example (Header component): `components/organisms/Header/Header.tsx`

---

## Hook Interface: `useWallet`

The custom `useWallet` hook returns the following properties:

| Name | Type | Description |
| :--- | :--- | :--- |
| `address` | `string \| null` | The connected client public key (G... address). `null` when disconnected. |
| `network` | `'PUBLIC' \| 'TESTNET'` | The active network specified by `config.stellar.network` mapping. |
| `status` | `WalletStatus` | The connection lifecycle status: `'disconnected' \| 'connecting' \| 'connected' \| 'error'`. |
| `error` | `string \| null` | Error message string if connection fails; reset to `null` on new connect attempts. |
| `connect` | `() => Promise<void>` | Action triggering the SEP-10 Freighter key retrieval, challenge fetching, signing, and verification. |
| `disconnect` | `() => Promise<void>` | Action deleting the session cookie on the server and purging client-side storage. |

---

## State Management and Rehydration

- **Immediate Hydration:** To prevent a flashing unconnected UI state when the user refreshes, the provider reads the connected wallet address from `sessionStorage` (key: `walletAddress`) on initial client render. If found, the status is immediately set to `connected`.
- **Session Verification:** Simultaneously, the provider fires an async call to `/api/auth/session` to verify with the backend whether the JWT cookie is still valid. If it's not valid, it resets the state to `disconnected` and purges the `sessionStorage` key.
- **SSR Safety:** The provider checks `typeof window !== 'undefined'` before interacting with `sessionStorage` or any browser APIs to prevent hydration mismatch errors or build issues.

---

## Usage Examples

### 1. Header/Navigation Component (Client-Side)

```tsx
"use client";

import React from "react";
import { useWallet } from "@/hooks/useWallet";

export const HeaderWalletButton = () => {
  const { address, status, error, connect, disconnect } = useWallet();

  if (status === "connecting") {
    return <button disabled>Connecting...</button>;
  }

  if (address) {
    return (
      <div>
        <span>Connected: {address.slice(0, 5)}...{address.slice(-4)}</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={connect}>Connect Wallet</button>
      {error && <span data-testid="wallet-error">{error}</span>}
    </div>
  );
};
```

### 2. Guarding Forms / Signing Transactions

```tsx
"use client";

import React from "react";
import { useWallet } from "@/hooks/useWallet";

export const LendingForm = () => {
  const { address, status } = useWallet();

  if (!address) {
    return <p>Please connect your wallet to deposit or borrow funds.</p>;
  }

  return (
    <form>
      {/* Transaction form fields */}
      <button type="submit">Submit Transaction</button>
    </form>
  );
};
```

### 3. Fetching the Active Network

The hook maps the backend network (`config.stellar.network`) to `'PUBLIC'` or `'TESTNET'`:

```tsx
const { network } = useWallet();
console.log("Current network:", network); // "TESTNET" or "PUBLIC"
```
