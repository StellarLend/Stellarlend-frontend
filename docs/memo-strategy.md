# Stellar Memo Allocation & Validation Strategy

To route inbound deposits made to a shared Stellar treasury/custodial address to individual user accounts, Stellarlend uses a deterministic memo allocation and verification system. This strategy ensures security, efficiency, and robustness against routing errors.

---

## 1. Supported Memo Types

Stellar transaction memos are used to associate payments with target user accounts. The system enforces strict formatting validation for the three primary memo types:

| Memo Type | Stellar Protocol Format | Validation Rule | Ideal Use Case |
|---|---|---|---|
| `MEMO_TEXT` | UTF-8 string up to 28 bytes. | Length <= 28 bytes (evaluated on UTF-8 byte size, not character length). | Human-readable IDs or base64 keys. |
| `MEMO_ID` | 64-bit unsigned integer (uint64). | Digits only (`/^\d+$/`) between `0` and `18446744073709551615`. | Sequential user database primary keys. |
| `MEMO_HASH` | 32-byte hex-encoded string. | Case-insensitive 64 hex characters (`/^[0-9a-fA-F]{64}$/`). | Crytographically secure identifiers. |
| `MEMO_RETURN` | 32-byte hex-encoded string. | Case-insensitive 64 hex characters (`/^[0-9a-fA-F]{64}$/`). | Refunding deposits / routing returns. |

---

## 2. Deterministic Derivation Strategy

To assign memos to users without generating massive database mapping tables, Stellarlend derives memos **deterministically** from the user's on-chain public key (`accountId`) using an HMAC-SHA256 hashing algorithm combined with a secret server-side salt (`MEMO_SALT`). 

```
Derived Bytes = HMAC-SHA256(MEMO_SALT, accountId)
```

### Derivation Algorithms:
1. **`MEMO_ID` (uint64)**:
   - Reads the first 8 bytes of the derived `HMAC-SHA256` hash as a Big-Endian 64-bit unsigned integer.
   - Example output: `13948205739205847382` (guaranteed to fit Stellar's uint64 bounds).
2. **`MEMO_HASH`**:
   - Converts the entire 32-byte derived hash into a 64-character lowercase hex string.
3. **`MEMO_TEXT`**:
   - Converts the derived hash into a Base64 string and takes the first 28 characters (safe for 28-byte limit).

This approach allows individual system instances to resolve deposit associations on-the-fly and attributes deposits consistently.

---

## 4. The Bidirectional Registry Pattern

For runtime efficiency, the derived mapping is cached and indexed in a bidirectional in-memory registry:
- **Forward Routing**: `accountId` $\rightarrow$ `StellarMemo`
- **Reverse Attribution**: `StellarMemo` $\rightarrow$ `accountId`

Forward mapping is pre-populated during account provisioning, and reverse mapping resolves the incoming transaction's owner on-chain and in webhooks instantly.

---

## 5. Enforcement & Configurable Strict Mode

To protect the protocol from unattributable deposits, Stellarlend supports a **Configurable Strict Mode** governed by environment variables:

| Environment Variable | Type | Default | Description |
|---|---|---|---|
| `STRICT_MEMO_MODE` | `boolean` | `false` | When `true`, enables active memo validation enforcement. |
| `MEMO_SALT` | `string` | `stellarlend-default-salt` | Secret HMAC salt key used for deterministic derivation. |

### Validation Flows:
1. **Webhook Handler (`app/api/webhooks/transactions/route.ts`)**:
   - If a webhook updates status for an inbound `Deposit` transaction:
     - **Strict Mode Enabled**: Rejects any deposit update containing an unknown/unregistered memo format or missing memo entirely with a `400 Bad Request`.
     - **Non-Strict Mode**: Logs unknown memos for review but updates status normally to avoid blocking standard operations.
   - Any transaction with a malformed memo value (e.g. invalid hex length or BigInt overflow) is **always** rejected with a `400 Bad Request`.

2. **Horizon Indexer (`lib/indexer/horizon.ts`)**:
   - During block index batch processing:
     - **Strict Mode Enabled**: Enforces that all inbound operations (`payment`, `create_account`, etc.) contain a valid, registered Stellar memo matching a known user account. If any operation lacks one or contains an unknown memo, the indexer throws an error, halting the batch to preserve data integrity.
     - **Non-Strict Mode**: Silently filters out operations with unknown or malformed memos while continuing index progress on standard transactions.

---

## 6. Usage Example

To map and resolve a user deposit memo at runtime:

```typescript
import { deriveAndRegisterMemo, resolveAccountByMemo } from "@/lib/stellar/memo";

// 1. When a user connects their wallet or requests a deposit address:
const userAccount = "GD2C...7A";
const memo = deriveAndRegisterMemo(userAccount, "MEMO_ID");
console.log(`Instruct user to pay to Shared Address with MEMO_ID: ${memo.value}`);

// 2. In the Horizon Indexer or Webhook handler:
const attributedAccount = resolveAccountByMemo(memo.value, "MEMO_ID");
if (attributedAccount) {
  console.log(`Attributed deposit directly to account: ${attributedAccount}`);
}
```
