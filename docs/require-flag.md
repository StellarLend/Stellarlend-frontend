# `requireFlag` Enforcement Contract

Server-side helper: [`lib/flags/requireFlag.ts`](../lib/flags/requireFlag.ts).

Related:

- Evaluator / rollout math: [`lib/flags/evaluator.ts`](../lib/flags/evaluator.ts)
- Flag config: [`config/feature-flags.json`](../config/feature-flags.json)
- Broader flag workflow: [`docs/feature-flags.md`](./feature-flags.md)
- Unit tests: [`lib/flags/requireFlag.test.ts`](../lib/flags/requireFlag.test.ts)

## Purpose

`requireFlag(flagKey, userId)` is the **hard gate** for server routes and server
components. Call it before side-effecting work; if the flag is not active for
`userId`, it throws and the caller maps that to a 403 (or equivalent).

It does **not** implement rollout bucketing itself. It delegates to
`evaluateFlag(flagKey, userId)` and treats a `false` result as “blocked”.

## Contract

| Input | Behaviour |
|---|---|
| Flag enabled for user (`evaluateFlag` → `true`) | Returns `void` (silent pass) |
| Flag disabled, missing, or outside rollout (`false`) | Throws `Error` |
| Evaluator throws | Error propagates unchanged |

### Disabled error message shape

```
Feature flag '<flagKey>' is disabled for user '<userId>'.
```

Callers should not parse this string for control flow beyond logging; use
`instanceof Error` and HTTP mapping instead.

### Safe-closed default

Unknown flag keys are **closed** (blocked). `evaluateFlag` returns `false` when
the key is absent from config, so `requireFlag` throws. Prefer that over
accidentally shipping an ungated route when a flag is renamed or deleted.

### Bucketed / percentage flags

Partial rollouts (`rollout: 0–100` plus optional per-user `overrides`) are
resolved inside `evaluateFlag` via deterministic djb2 bucketing. `requireFlag`
only sees the boolean outcome:

- user in bucket / override true → pass  
- user outside bucket / override false / master `enabled: false` → throw  

See [`docs/feature-flags.md`](./feature-flags.md) § “Bucketing & Rollout Engine”.

## Usage pattern

```ts
import { requireFlag } from '@/lib/flags/requireFlag';

export async function GET() {
  try {
    requireFlag('newDashboard', user.id);
  } catch {
    return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
  }
  // feature body…
}
```

## What not to do

- Do not catch and ignore the throw without returning a non-2xx response.
- Do not reimplement rollout math in the route; keep gating in `requireFlag` /
  `evaluateFlag` so tests and docs stay single-sourced.
- Do not use `requireFlag` on the pure client tree — use `FeatureGate` /
  `useFeatureFlag` instead (see feature-flags guide).
