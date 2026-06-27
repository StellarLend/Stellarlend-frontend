# Feature Flag Evaluator Test Plan

This suite documents the unit coverage added for `lib/flags/evaluator.ts`.

## Covered behavior

- Unknown flag keys return the safe default `false`.
- Repeated evaluation for the same user and flag is deterministic.
- Disabled flags, `0%` rollout, and `100%` rollout are handled explicitly.
- User overrides take precedence over the global enabled and rollout settings.
- A deterministic 1,000-user sample keeps a `50%` rollout within a narrow proportional band.
- `evaluateAllFlags` returns a complete boolean map for every configured flag.

## Verification

Run the focused suite with:

```bash
npm test -- lib/flags/evaluator.test.ts --run
```

The test mocks the feature-flag config read so fixtures stay isolated from the checked-in `config/feature-flags.json` file.
