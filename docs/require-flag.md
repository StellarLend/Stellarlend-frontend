# Feature Flag Enforcement Contract

`lib/flags/requireFlag.ts` is the server-side assertion helper for code paths
that must fail closed when a feature is disabled.

## Runtime Contract

```ts
requireFlag("accountExport", userId);
```

- Calls `evaluateFlag(flagKey, userId)` with the exact flag key and user id.
- Returns `void` when the evaluator says the flag is enabled.
- Throws `Error("Feature flag '<flag>' is disabled for user '<user>'.")` when
  the evaluator returns `false`.
- Unknown flags are safe by default because `evaluateFlag` returns `false` for
  missing config entries.
- Percentage or bucketed rollout decisions are owned by `evaluateFlag`;
  `requireFlag` only enforces the boolean decision it receives.

## Failure Modes

`requireFlag` does not catch or rewrite evaluator exceptions. If the evaluator
throws because configuration cannot be loaded or parsed, the original error
propagates to the caller. Route handlers that need a specific HTTP envelope
should catch this at the route boundary and map it to the standard API error
shape.

## Review Notes

The test coverage for this helper uses a mocked evaluator so it can focus on
the enforcement contract without mutating `config/feature-flags.json` or relying
on a particular rollout hash bucket.
