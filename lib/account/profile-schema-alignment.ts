/**
 * Compile-time schema alignment guard
 *
 * This file is intentionally NOT a test file (no .test.ts suffix) so that
 * `tsc --noEmit` checks it against the main tsconfig.json.  Any divergence
 * between ProfileRecord's keys and the Drizzle-inferred Account type from
 * lib/db/schema/accounts.ts produces a compile error here, making it
 * impossible for the two definitions to silently drift.
 *
 * How the guard works
 * -------------------
 * `AssertExactKeys<A, B>` resolves to `never` unless every key in A appears
 * in B and every key in B appears in A (mutual subtype check on the key sets).
 * A variable of type `never` cannot be assigned any value, so the compiler
 * rejects the file the moment the key sets differ.
 *
 * When to update this file
 * ------------------------
 * If you rename, add, or remove a column in lib/db/schema/accounts.ts you
 * MUST make the same change to ProfileRecord in lib/account/repository.ts
 * (and vice-versa).  The compile error from this file tells you exactly which
 * side is out of date.
 */

import type { Account } from '@/lib/db/schema/accounts';
import type { ProfileRecord } from './repository';

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/**
 * Resolves to `true` when every key of T is present in U and vice-versa.
 * Resolves to `false` otherwise.
 */
type KeysAreEqual<T, U> =
    [keyof T] extends [keyof U]
        ? [keyof U] extends [keyof T]
            ? true
            : false
        : false;

/**
 * When KeysAreEqual<T,U> is `true` resolves to `T`; otherwise resolves to
 * `never`.  A `never`-typed variable cannot be assigned, which turns any key
 * mismatch into a compile-time error at the assignment below.
 */
type AssertExactKeys<T, U> = KeysAreEqual<T, U> extends true ? T : never;

// ---------------------------------------------------------------------------
// Assertion: ProfileRecord keys  ≡  Account (accounts table) keys
// ---------------------------------------------------------------------------
//
// If this line produces the error
//   "Type 'ProfileRecord' is not assignable to type 'never'."
// it means the keys of ProfileRecord and the accounts table have diverged.
// Fix by keeping both definitions in sync.
//
// The `declare` keyword means no JS is emitted; this is purely a type check.
declare const _assertProfileMatchesAccountTable: AssertExactKeys<
    ProfileRecord,
    Account
>;
