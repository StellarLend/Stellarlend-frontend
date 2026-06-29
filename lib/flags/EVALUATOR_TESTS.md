# Feature Flag Evaluator Test Plan

## Overview

This document describes the test strategy for `lib/flags/evaluator.ts` to ensure:
1. Deterministic user bucketing for rollouts
2. Correct evaluation of flag enabled/disabled status
3. Proper handling of user overrides
4. Correct rollout percentage behavior (0%, 100%, intermediate values)
5. Graceful handling of unknown flags

## Test Cases

### 1. getFlags()
- Verifies flags are loaded from config file correctly
- Checks error handling when config file is missing (returns empty object)

### 2. evaluateFlag()

#### Unknown flag
- Returns false for keys not present in config

#### Disabled flag
- Returns false when `enabled: false`

#### 0% rollout
- Returns false even when `enabled: true`

#### 100% rollout
- Returns true for all users

#### No rollout defined
- Treats as 100% rollout (returns true for all users)

#### User overrides
- Uses override value first, regardless of rollout percentage
- Tests both true and false overrides

#### Determinism
- Multiple calls with the same userId and flagKey must return same value
- Tests that hash function produces stable results

#### Proportional bucketing
- Tests that intermediate rollout percentages (e.g., 50%) bucket users proportionally
- Verifies roughly expected distribution with a large sample size (1000 users)

### 3. evaluateAllFlags()
- Evaluates all flags for a single user and returns a map of flagKey → boolean

## Running Tests

```bash
npm test -- evaluator
# or with pnpm
pnpm test -- evaluator
```
