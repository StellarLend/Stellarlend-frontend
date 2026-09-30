import type { Transaction } from "@/types/Transaction";

export type TransactionSortKey = "date" | "amount" | "status";
export type TransactionSortOrder = "asc" | "desc";

function compareByDateTime(left: Transaction, right: Transaction) {
  const leftTime = new Date(`${left.date} ${left.time}`).getTime();
  const rightTime = new Date(`${right.date} ${right.time}`).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    const dateDiff = left.date.localeCompare(right.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.time.localeCompare(right.time);
  }

  return leftTime - rightTime;
}

export function getTransactionComparator(
  sortKey: TransactionSortKey,
  sortOrder: TransactionSortOrder,
) {
  const direction = sortOrder === "asc" ? 1 : -1;

  return (left: Transaction, right: Transaction) => {
    let comparison = 0;

    switch (sortKey) {
      case "amount":
        comparison = left.amount - right.amount;
        break;
      case "status":
        comparison = left.status.localeCompare(right.status, "en", { sensitivity: "base" });
        break;
      case "date":
      default:
        comparison = compareByDateTime(left, right);
        break;
    }

    if (comparison === 0) {
      comparison = compareByDateTime(left, right);
    }

    if (comparison === 0) {
      comparison = left.id.localeCompare(right.id, "en", { sensitivity: "base" });
    }

    return comparison * direction;
  };
}

export function sortTransactions(
  transactions: Transaction[],
  sortKey: TransactionSortKey,
  sortOrder: TransactionSortOrder,
) {
  return [...transactions].sort(getTransactionComparator(sortKey, sortOrder));
}
