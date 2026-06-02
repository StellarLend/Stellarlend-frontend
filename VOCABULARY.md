# Transaction Vocabulary

Single source of truth for all asset symbols, transaction types, and transaction statuses used across the API and UI.

**Canonical file:** [`types/enums.ts`](./types/enums.ts)

---

## Supported Values



### Asset Symbols (`AssetSymbol`)

| Symbol | Name            |
|--------|-----------------|
| `XLM`  | Stellar Lumens  |
| `USDC` | USD Coin        |
| `BTC`  | Bitcoin         |
| `ETH`  | Ethereum        |

### Transaction Types (`TransactionType`)

| Value          | Description                        |
|----------------|------------------------------------|
| `Deposit`      | Funds deposited into the platform  |
| `Withdrawal`   | Funds withdrawn from the platform  |
| `Lend Funds`   | Assets lent to the protocol        |
| `Loan Payment` | Repayment of a borrowed loan       |

### Transaction Statuses (`TransactionStatus`)

| Value        | Description                        |
|--------------|------------------------------------|
| `Completed`  | Transaction settled successfully   |
| `Processing` | Transaction in progress            |
| `Failed`     | Transaction did not complete       |

---

## API Validation

`GET /api/transactions` and `POST /api/transactions` reject any value outside the above sets with HTTP 400 and a descriptive error message listing the supported values, e.g.:

```json
{ "error": "Unknown asset \"STRK\". Supported: XLM, USDC, BTC, ETH" }
```

---

## Migration Note

Prior to this change, `types/Transaction.ts` constrained `asset` to `"XLM" | "BTC" | "STRK"`. The vocabulary has been updated to match the README and the UI:

- `STRK` is **removed** — it was never listed in the README and has no icon or rate configuration in the lending forms.
- `USDC` and `ETH` are **added** — both were already present in the lending forms and promised by the README.

**Existing mock data** that references `STRK` must be updated. The mock transactions in `types/Transaction.ts` have been migrated: the former `STRK` entries now use `USDC` and `ETH`.

If you have persisted data (database rows, fixtures, seeds) that contain `asset: "STRK"`, update those records to a valid symbol before deploying this change.
