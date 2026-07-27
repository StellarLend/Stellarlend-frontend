# Horizon Indexer Resume Semantics & Failure Architecture

## Process Resumption
The indexer queries the `indexer_cursors` table atomically during boot sequence to identify the exact paging token boundary where the last successful chunk ingest finalized.

> **Note (implementation):** The text above describes durable, DB-backed cursor semantics. The current codebase uses an in-memory cursor implementation (`lib/indexer/cursor.ts`) which does not persist across process restarts; a real restart will lose the cursor and will not resume from the documented checkpoint. When a DB-backed cursor is implemented, add an integration test to verify the restart/resume semantics described here.

## Failure & Replay Behavior
* **Crash-Mid-Batch:** If a process termination occurs mid-batch before the database transaction commits, the checkpoint cursor remains unaltered. Upon restart, the indexer re-fetches the identical block slice.
* **Idempotency Safeguard:** To safely handle replayed blocks without producing duplicate records, underlying table keys rely on deterministic transaction hashes combined with unique ledger index numbers as composite unique primary keys.
