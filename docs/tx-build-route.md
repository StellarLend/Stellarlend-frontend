# Transaction Build Route

`POST /api/tx/build` builds an unsigned Soroban transaction envelope for lending
and borrowing flows, then simulates the unsigned envelope before returning it to
the client. The route is server-only and proxies calls to the configured Soroban
RPC endpoint.

## Request

The request body must be a JSON object with:

| Field                   | Type                   | Notes                                                                    |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `type`                  | `"lend"` or `"borrow"` | Selects the Soroban contract function.                                   |
| `sourceAccount`         | Stellar public key     | Must be a non-empty `G...` account id.                                   |
| `data.asset`            | string                 | Asset code sent as the first contract argument.                          |
| `data.amount`           | number                 | Converted to a `u64` string argument.                                    |
| `data.interestRate`     | number                 | Converted to a string argument.                                          |
| `data.duration`         | number                 | Required by borrow requests; defaults to `0` in the builder when absent. |
| `data.collateral`       | string                 | Borrow-only collateral asset, defaulting to an empty string when absent. |
| `data.collateralAmount` | number                 | Borrow-only collateral amount, defaulting to `0` when absent.            |

Malformed JSON, unsupported `type`, invalid `sourceAccount`, missing `data`, and
incorrect field types return:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request body."
  }
}
```

with HTTP status `400`.

## Build Flow

For valid input the route sends a `build_soroban_transaction` JSON-RPC request
to the private Soroban RPC URL using the configured contract id and network
passphrase. A lend request produces a single `invoke_host_function` instruction
with `asset`, `amount`, and `interestRate` arguments. A borrow request includes
the same base arguments plus `duration`, `collateral`, and `collateralAmount`.

If the build response includes `result.transaction` or `result.transaction_xdr`,
the route sends a second `simulateTransaction` RPC call with that unsigned XDR.

## Success Response

Successful responses return HTTP `200`:

```json
{
  "unsignedXdr": "AAAA...",
  "simulation": {
    "transactionDataXdr": "AAAA...",
    "minResourceFee": "3210",
    "footprint": {
      "readOnly": [],
      "readWrite": []
    },
    "auth": []
  }
}
```

The simulation object is normalized by `lib/soroban/simulate.ts` so callers can
consume camelCase fields even when the upstream RPC uses snake_case fields.

## Error Responses

| Status | Code                                   | Cause                                                             |
| ------ | -------------------------------------- | ----------------------------------------------------------------- |
| `400`  | `INVALID_INPUT`                        | Request body cannot be parsed or does not match the build schema. |
| `429`  | `RATE_LIMIT_EXCEEDED`                  | Authenticated wallet exceeded the account bucket limit.           |
| `500`  | `CONFIGURATION_ERROR`                  | The server has no configured Soroban contract id.                 |
| `502`  | upstream code or `RPC_ERROR`           | The build RPC failed or returned no unsigned envelope.            |
| `409`  | `RESTORE_REQUIRED`                     | Simulation indicates archived ledger entries must be restored.    |
| `422`  | `AUTH_REQUIRED` or `SIMULATION_FAILED` | Simulation needs extra authorization or rejected the transaction. |
| `502`  | `SIMULATION_UNAVAILABLE`               | Simulation transport failed or timed out.                         |

The route does not submit or sign transactions. Clients must sign the returned
`unsignedXdr` and submit it through the transaction submission flow.
