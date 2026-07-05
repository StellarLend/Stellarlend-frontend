# Feature Flag Enforcement Contract

`lib/flags/requireFlag.ts` is the narrow guard used by server-side code that
must stop when a feature flag is unavailable for a caller.

## Contract

- The guard delegates all flag decisions to `evaluateFlag(flagKey, userId)`.
- A `true` evaluator result allows the caller to continue.
- A `false` evaluator result throws a deterministic error that includes the
  flag key and user id.
- Unknown flags remain safe because the evaluator returns `false` for missing
  configuration.
- Bucketed and percentage rollout behavior stays inside the evaluator; the
  guard must not duplicate rollout math.
- Evaluator failures propagate rather than silently enabling the feature.

## Tested Cases

Run:

```bash
npm test -- lib/flags/requireFlag.test.ts
```

The test suite covers:

- enabled flag pass-through
- disabled flag rejection
- unknown flag closed-state behavior
- bucketed rollout decisions delegated to the evaluator
- evaluator errors remaining closed by propagation

## Out Of Scope

The guard does not load configuration, hash users into buckets, or evaluate all
flags. Those behaviors belong to `lib/flags/evaluator.ts` and are documented in
`lib/flags/EVALUATOR_TESTS.md`.
