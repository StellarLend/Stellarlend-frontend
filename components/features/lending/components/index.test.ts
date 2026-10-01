import * as LendingComponents from "./index";

const publicComponentExports = [
  "LendingForm",
  "BorrowingForm",
  "InterestCalculator",
  "TransactionSummary",
  "ConfirmModal",
  "RepayForm",
  "TabSelector",
  "WithdrawForm",
  "MarketsTable",
] as const;

describe("lending components barrel", () => {
  it.each(publicComponentExports)("resolves the %s public export", (name) => {
    expect(LendingComponents[name]).toBeDefined();
  });
});
