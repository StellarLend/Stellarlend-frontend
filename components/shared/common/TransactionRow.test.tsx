import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TransactionRow,
  TransactionMobileRow,
} from "./TransactionRow";
import type { Transaction } from "@/types/Transaction";

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockWalletNetwork = vi.hoisted(() => ({ current: "TESTNET" as string }));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ network: mockWalletNetwork.current }),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validHash =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd";

const baseTxn: Transaction = {
  id: "TXN-001",
  type: "Deposit",
  amount: 100,
  asset: "XLM",
  date: "2024-04-01",
  time: "10:00AM",
  status: "Completed",
};

function renderRow(overrides: Partial<Transaction> = {}, props: Partial<{
  isFocused: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onFocusRow: (index: number) => void;
  onKeyDownRow: (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => void;
  onSelectTxn: (txn: Transaction) => void;
  setRowRef: (index: number, node: HTMLTableRowElement | null) => void;
}> = {}) {
  const onFocusRow = props.onFocusRow ?? vi.fn();
  const onKeyDownRow = props.onKeyDownRow ?? vi.fn();
  const onSelectTxn = props.onSelectTxn ?? vi.fn();
  const setRowRef = props.setRowRef ?? vi.fn();

  render(
    <table>
      <tbody>
        <TransactionRow
          txn={{ ...baseTxn, ...overrides }}
          actualIndex={0}
          isFocused={props.isFocused ?? false}
          isExpanded={props.isExpanded ?? false}
          isPending={props.isPending ?? false}
          onFocusRow={onFocusRow}
          onKeyDownRow={onKeyDownRow}
          onSelectTxn={onSelectTxn}
          setRowRef={setRowRef}
        />
      </tbody>
    </table>,
  );

  return { onFocusRow, onKeyDownRow, onSelectTxn, setRowRef };
}

describe("TransactionRow", () => {
  beforeEach(() => {
    mockWalletNetwork.current = "TESTNET";
  });

  // ── Keyboard row-selection ────────────────────────────────────────────────

  describe("keyboard row-selection", () => {
    it("forwards keydown events to onKeyDownRow with the row's actualIndex", () => {
      const { onKeyDownRow } = renderRow();

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      row.focus();
      row.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );

      expect(onKeyDownRow).toHaveBeenCalledTimes(1);
      expect(onKeyDownRow.mock.calls[0][1]).toBe(0);
      expect(onKeyDownRow.mock.calls[0][0].key).toBe("ArrowDown");
    });

    it("calls onFocusRow with the row's actualIndex when the row receives focus", () => {
      const { onFocusRow } = renderRow();

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      row.focus();

      expect(onFocusRow).toHaveBeenCalledWith(0);
    });

    it("calls onSelectTxn with the transaction when Details is clicked", () => {
      const onSelectTxn = vi.fn();
      const txn = { ...baseTxn };
      renderRow(txn, { onSelectTxn });

      screen.getByRole("button", { name: /details/i }).click();

      expect(onSelectTxn).toHaveBeenCalledWith(expect.objectContaining({ id: "TXN-001" }));
    });

    it("is keyboard-focusable via tabIndex so keyboard row-selection is possible", () => {
      renderRow();

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      expect(row).toHaveAttribute("tabindex", "0");
    });
  });

  // ── Pending-transaction visual state ─────────────────────────────────────

  describe("pending-transaction visual state", () => {
    it("applies the pending styles when isPending is true", () => {
      renderRow(baseTxn, { isPending: true });

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      expect(row.className).toContain("animate-pulse");
      expect(row.className).toContain("border-dashed");
      expect(row.className).toContain("bg-blue-50/50");
    });

    it("does not apply pending styles when isPending is false", () => {
      renderRow(baseTxn, { isPending: false });

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      expect(row.className).not.toContain("animate-pulse");
      expect(row.className).toContain("border-gray-300");
    });

    it("suppresses the focused highlight while pending, even if isFocused is true", () => {
      renderRow(baseTxn, { isPending: true, isFocused: true });

      const row = screen.getByRole("row", { name: /transaction txn-001/i });
      expect(row.className).not.toContain("bg-gray-100");
    });
  });

  // ── Explorer-link construction ───────────────────────────────────────────

  describe("explorer-link construction", () => {
    it("renders an explorer link pointing at Stellar Expert when the transaction has a valid hash", () => {
      renderRow({ hash: validHash });

      const link = screen.getByRole("link", {
        name: /view transaction txn-001 on stellar expert/i,
      });
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/tx/${validHash}`,
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("builds a public-network explorer URL when the wallet network is PUBLIC", () => {
      mockWalletNetwork.current = "PUBLIC";
      renderRow({ hash: validHash });

      const link = screen.getByRole("link", {
        name: /view transaction txn-001 on stellar expert/i,
      });
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/public/tx/${validHash}`,
      );
    });

    it("does not render an explorer link when the transaction has no hash", () => {
      renderRow({ hash: undefined, txHash: undefined });

      expect(
        screen.queryByRole("link", { name: /view transaction .* on stellar expert/i }),
      ).not.toBeInTheDocument();
    });

    it("does not render an explorer link when the id is not a valid Stellar tx hash", () => {
      renderRow({ id: "TXN-NOT-A-HASH", hash: undefined, txHash: undefined });

      expect(
        screen.queryByRole("link", { name: /view transaction .* on stellar expert/i }),
      ).not.toBeInTheDocument();
    });
  });
});

describe("TransactionMobileRow", () => {
  beforeEach(() => {
    mockWalletNetwork.current = "TESTNET";
  });

  it("applies the pending styles to the mobile card when isPending is true", () => {
    const { container } = render(
      <TransactionMobileRow
        txn={baseTxn}
        isExpanded={false}
        isPending
        onSelectTxn={vi.fn()}
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("animate-pulse");
    expect(card.className).toContain("border-dashed");
  });

  it("renders an explorer link with a valid hash and omits it without one", () => {
    const { rerender } = render(
      <TransactionMobileRow
        txn={{ ...baseTxn, hash: validHash }}
        isExpanded={false}
        onSelectTxn={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: /view transaction txn-001 on stellar expert/i }),
    ).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${validHash}`);

    rerender(
      <TransactionMobileRow
        txn={{ ...baseTxn, hash: undefined, txHash: undefined }}
        isExpanded={false}
        onSelectTxn={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /view transaction .* on stellar expert/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onSelectTxn when Details is clicked", () => {
    const onSelectTxn = vi.fn();
    render(
      <TransactionMobileRow
        txn={baseTxn}
        isExpanded={false}
        onSelectTxn={onSelectTxn}
      />,
    );

    screen.getByRole("button", { name: /details/i }).click();

    expect(onSelectTxn).toHaveBeenCalledWith(expect.objectContaining({ id: "TXN-001" }));
  });
});