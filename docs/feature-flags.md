# Feature Flags & Rollout Workflow Guide

This guide describes how to author, evaluate, roll out, and retire feature flags in the Stellarlend frontend. Feature flags allow us to safely deploy code, perform canary rollouts, and gate unfinished features without branching.

---

## 1. Request, Caching & Test Infrastructure

The application exposes a client-side `/api/feature-flags` route that evaluates configured flags for a specific caller.

### API Endpoint Contract
- **Method**: `GET /api/feature-flags`
- **Identity Header**: `x-user-id` request header
- **Anonymous Fallback**: If the `x-user-id` header is missing, the evaluator defaults to evaluating flags for the user ID `"anonymous"`.
- **Response**: A JSON object mapping flag keys to booleans:
  ```json
  {
    "newDashboard": true,
    "betaFeature": false
  }
  ```

### Caching Strategy
- **Scope**: Cached per resolved user ID (`x-user-id`).
- **TTL**: 5 minutes.
- **Behavior**: Subsequent requests for the same user signature within the TTL return the cached flags without executing evaluating code again, preserving server cycles.

### Unit & Integration Testing
Run server-side evaluator tests using:
```bash
npm run test:server -- app/api/feature-flags/route.test.ts
```

---

## 2. Flag Configuration Schema & Bucketing Semantics

Feature flags are configured in the `config/feature-flags.json` file. 

### JSON Schema

The configuration file is a map of flag keys to configuration objects:

```json
{
  "newDashboard": {
    "enabled": true,
    "rollout": 25,
    "overrides": {
      "user-123-uuid": true,
      "user-456-uuid": false
    }
  }
}
```

Each flag configuration may include:
- **`enabled`** (`boolean`): The master toggle. If `false`, the flag is instantly disabled for all users (except those in `overrides`).
- **`rollout`** (`number`, optional): A percentage integer between `0` and `100` representing the target footprint of users for whom this flag should resolve to `true`. If omitted, defaults to `100` (meaning fully rolled out).
- **`overrides`** (`Record<string, boolean>`, optional): Map of user IDs directly to their desired flag states. Overrides take the highest precedence.

### Bucketing & Rollout Engine

For partial rollouts (`rollout` less than 100%), the application uses a **deterministic djb2 hash-bucketing algorithm** to assign users to buckets in stateless manner:

1. **Hash Key**: The evaluator concatenates the user identity and the flag key: `userId + ":" + flagKey`.
2. **Djb2 Hashing**: The concatenated string is passed to `hashString()` where it generates a numeric hash.
3. **Modulo Action**: The result is mapped to a bucket number between `0` and `99` using `hash % 100`.
4. **Bucket Gate**: If `bucket < rollout`, the feature flag returns `true`. Otherwise, it returns `false`.

This guarantees that:
- Rollouts are completely deterministic and sticky (a given user will always fall into the same bucket for a given flag).
- Buckets are distributed evenly across users.
- Independent flags distribute callers differently (since the flag key is part of the hash key).

---

## 3. Gating Patterns & Examples

### A. Client-Side Gating: UI `FeatureGate`

For component or page-level UI branches, wrap the client-side elements in the `<FeatureGate>` wrapper component.

- **Component Path**: `components/shared/common/FeatureGate.tsx`
- **Hook Path**: `hooks/useFeatureFlag.ts`

#### Copy-Pasteable UI Example:
```tsx
"use client";

import React from "react";
import { FeatureGate } from "@/components/shared/common/FeatureGate";
import { OldMetricsCard } from "../components/OldMetricsCard";
import { NewMetricsCard } from "../components/NewMetricsCard";

export const DashboardStats = () => {
  return (
    <div>
      <h3>Platform Metrics</h3>
      <FeatureGate flag="newDashboard" fallback={<OldMetricsCard />}>
        {/* Rendered only if feature flag is active for this user */}
        <NewMetricsCard />
      </FeatureGate>
    </div>
  );
};
```

### B. Server-Side Gating: Route Gating `requireFlag`

To prevent access to API route handlers or server-side pages, assert the flag presence via the `requireFlag` helper in your backend logic.

- **Helper Path**: `lib/flags/requireFlag.ts`
- **Evaluator Path**: `lib/flags/evaluator.ts`

#### Copy-Pasteable API route Example:
```typescript
import { NextResponse } from "next/server";
import { requireFlag } from "@/lib/flags/requireFlag";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // 1. Fetch user context & session from headers/cookies
    const user = await getAuthenticatedUser();
    
    // 2. Gate route using requireFlag - throws error if disabled
    requireFlag("newDashboard", user.id);
    
    // 3. Return feature response
    return NextResponse.json({
      metrics: {
        activeLenders: 1420,
        totalSuppliedUsdc: 950000
      }
    });
  } catch (error: any) {
    // Handle error or unauthorized access
    console.warn("Gated path access rejected:", error.message);
    return NextResponse.json(
      { error: "Feature not available or access denied" },
      { status: 403 }
    );
  }
}
```

---

## 4. Flag-Removal & Clean Up Checklist

Feature flags are short-lived. To avoid tech debt and codebase drift, once a feature is 100% rolled out or dismissed, execute retired flag cleanup using this checklist:

- [ ] **Remove UI references**: Search the code for `<FeatureGate flag="myFlag">` or `useFeatureFlag("myFlag")` and replace them with direct JSX rendering. Delete old/fallback UI paths or components.
- [ ] **Remove Route API checks**: Delete `requireFlag("myFlag", ...)` checks from route handlers. Remove deprecation gates.
- [ ] **Delete from JSON Config**: Delete the flag key and config object from `config/feature-flags.json`.
- [ ] **Clean Up Mocks / Test Cases**: Search for `"myFlag"` in tests (e.g. `__tests__` or `route.test.ts`) and remove assertions, imports, or configs related to the retired flag.
- [ ] **Verify Build & Run Lint**: Compile the codebase (`npm run build`) and run ESLint (`npm run lint`) to confirm all imports, parameters, and variable references are correctly cleaned up.
