# Soroban Transaction Preflight

The transaction relay now pre-simulates Soroban transactions before they are
handed to the network RPC.

## Build Flow

`POST /api/tx/build` now performs two server-side steps:

1. Build an unsigned transaction with `build_soroban_transaction`.
2. Pre-simulate the returned XDR with `simulateTransaction`.

On success the API returns:

- `unsignedXdr`: the unsigned transaction envelope to sign
- `simulation.transactionDataXdr`: Soroban transaction data returned by simulation
- `simulation.minResourceFee`: the resource fee estimate returned by the RPC
- `simulation.footprint`: the computed read-only and read-write ledger key sets
- `simulation.auth`: any auth entries surfaced by simulation

## Submit Flow

`POST /api/tx/submit?simulate=true` performs an additional preflight simulation
before sending the signed envelope to `send_transaction`.

This is optional so existing clients remain compatible, but enabling the flag
prevents obviously failing submissions from consuming fees or entering the RPC
queue.

## Error Mapping

Simulation failures are mapped to safe API errors instead of leaking raw RPC or
transport details:

- `RESTORE_REQUIRED` with HTTP `409` when archived ledger entries must be restored
- `AUTH_REQUIRED` with HTTP `422` when additional authorization is needed
- `SIMULATION_FAILED` with HTTP `422` for other deterministic preflight failures
- `SIMULATION_UNAVAILABLE` with HTTP `502` when the simulation RPC cannot be reached

Routes continue to use the existing `{ error: { code, message, data? } }`
envelope so clients can handle preflight failures consistently.
