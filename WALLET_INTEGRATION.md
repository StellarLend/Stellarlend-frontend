# Stellar Wallet Integration

This document outlines the connection lifecycle, components, utilities, and error handling patterns for Stellar wallet integration in the Stellarlend frontend application.

## Overview

The wallet connection utilizes the `useWalletContext` provider, which interfaces with client-side browser wallet extensions (e.g., Freighter) and backend API endpoints to establish a authenticated session conforming to **SEP-10** (Stellar Web Authentication).

```
+------------------+         Get Public Key         +-------------------+
|  Browser Extension| <---------------------------- |   WalletProvider  |
|    (Freighter)   | ----------------------------> |   (Client Context)|
+------------------+       Client Public Key       +-------------------+
                                                             |
                                                             | Fetch Challenge
                                                             v
+------------------+       Sign Transaction         +-------------------+
|  Browser Extension| <---------------------------- |  /api/auth/challenge|
|    (Freighter)   | ----------------------------> |      (Backend)     |
+------------------+       Signed Tx Envelope       +-------------------+
                                                             |
                                                             | Verify Signature
                                                             v
+------------------+        Establish Session       +-------------------+
|   WalletProvider  | <---------------------------- |  /api/auth/verify |
|  (Client Context)|                                |      (Backend)     |
+------------------+                                +-------------------+
```

---

## Connection Lifecycle

### 1. Detection
When the user triggers the connection flow, the application checks for the presence of `window.stellar` (Freighter or equivalent Stellar wallet provider).
If not found, a descriptive error message: `"Stellar wallet provider (Freighter) not detected"` is thrown and surfaced in the UI.

### 2. Address Retrieval
The application calls `stellar.getPublicKey()` to retrieve the user's active account address.
- **Validation**: Before persisting the address or starting the SEP-10 handshake, the application validates that the address is a valid **56-character Stellar public key** starting with `G`.

### 3. SEP-10 Challenge & Sign
- A request is sent to `/api/auth/challenge` with the user's public key.
- The server generates a SEP-10 challenge transaction signed by the server's signing key.
- The challenge transaction is returned to the client.
- The client prompts the user to sign the transaction via the wallet extension: `stellar.signTransaction(transaction, { network })`.

### 4. Verification & Session Establishment
- The signed transaction is sent to `/api/auth/verify` for validation.
- The server verifies the client's signature against the client public key.
- Upon successful validation, the server establishes a secure session (typically set via HttpOnly session cookies) and returns the validated wallet address.
- The client context updates its state: `address` is set, `status` becomes `"connected"`, and `sessionStorage.setItem("walletAddress", address)` is configured for immediate hydration on subsequent page loads.

### 5. Disconnection
When the user clicks **Disconnect Wallet**:
- The application calls `/api/auth/session` with the `DELETE` HTTP method to clear the server-side session.
- Local client state is cleared, status returns to `"disconnected"`, and the cached address is removed from `sessionStorage`.

---

## Error Handling

All wallet connection errors are caught inside the context and exposed to consumer components via the `error` state.

### Common Error Scenarios

1. **Freighter Not Installed**
   - **Trigger**: `window.stellar` is undefined.
   - **UI Resolution**: Surfaces `"Stellar wallet provider (Freighter) not detected"` inline in the `WalletConnectButton` error label.

2. **User Rejects Connection**
   - **Trigger**: User cancels the prompt or rejects sharing the public key.
   - **UI Resolution**: Surfaces `"User rejected connection request"` or the specific rejection message from Freighter.

3. **Invalid Public Key**
   - **Trigger**: Wallet returns a key that fails the 56-character `G`-prefixed format validation.
   - **UI Resolution**: Surfaces `"Invalid Stellar public key"` error, preventing the session request.

4. **Network / Server Error**
   - **Trigger**: Failed challenge generation or verification endpoint failure.
   - **UI Resolution**: Surfaces the backend error message (e.g., `"Verification failed"`) without crashing the header or application.

---

## Usage in Components

The UI is driven by the state of `useWalletContext()`.

```tsx
import { useWalletContext } from "@/context/WalletContext";

const MyComponent = () => {
  const { address, status, error, connect, disconnect } = useWalletContext();
  
  // Render based on status: "disconnected" | "connecting" | "connected" | "error"
};
```

Refer to [WalletConnectButton](file:///c:/Users/opulencechuks/Stellarlend-frontend/components/features/wallet/WalletConnectButton.tsx) for a complete example of standard rendering, state transitions, accessible attributes, and focus rings.
