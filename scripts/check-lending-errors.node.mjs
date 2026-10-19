import test from "node:test";
import assert from "node:assert/strict";
import { compareLendingErrors } from "./check-lending-errors.mjs";

test("drift check passes when contract and frontend entries match", () => {
  assert.deepEqual(
    compareLendingErrors([{ code: 1001, name: "InvalidAmount" }], [{ code: 1001, name: "InvalidAmount" }]),
    [],
  );
});

test("drift check rejects contract codes missing from the frontend", () => {
  const failures = compareLendingErrors(
    [{ code: 1001, name: "InvalidAmount" }, { code: 9999, name: "NewError" }],
    [{ code: 1001, name: "InvalidAmount" }],
  );
  assert.deepEqual(failures, ["Missing frontend entry for contract error 9999 (NewError)."]);
});

test("drift check rejects duplicate numeric codes", () => {
  const failures = compareLendingErrors(
    [{ code: 1001, name: "InvalidAmount" }],
    [{ code: 1001, name: "InvalidAmount" }, { code: 1001, name: "OtherError" }],
  );
  assert.ok(failures.some((failure) => failure.includes("Duplicate frontend error code 1001")));
});
