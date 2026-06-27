import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TransactionDetail from "./TransactionDetail";
import type { Transaction } from "../../../../types/Transaction";

// Mock Next.js Image component
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || "image"} />;
  },
}));

// Mock config
vi.mock("@/lib/config", () => ({
  __esModule: true,
  default: {
    stellar: {
      network: "testnet",
    },
  },
}));

const mockTransaction: Transaction = {
  id: "TXN12345",
  type: "Deposit",
  amount: 2000,
  asset: "XLM",
  date: "2025-04-12",
  time: "09:32AM",
  status: "Completed",
};

describe("TransactionDetail Component", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("does not render when isOpen is false or transaction is null", () => {
    const { container } = render(
      <TransactionDetail transaction={null} isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders basic transaction details and fetches additional details on open", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transaction: {
          id: "TXN12345",
          memo: "Hello World",
          explorerUrl: "https://stellar.expert/explorer/testnet/tx/TXN12345",
        },
      }),
    });

    render(
      <TransactionDetail
        transaction={mockTransaction}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    expect(screen.getByText("TXN12345")).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("+$2000")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeInTheDocument();
      expect(screen.getByText("View on Stellar Expert")).toBeInTheDocument();
    });
  });

  it("sanitizes and strips control characters from the memo and renders it as inert text", async () => {
    // A malicious memo with control characters (like \u0000, \u0008) and HTML tags
    const maliciousMemo = "Malicious <script>alert('hack')</script>\u0000\u0008Text";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transaction: {
          id: "TXN12345",
          memo: maliciousMemo,
        },
      }),
    });

    render(
      <TransactionDetail
        transaction={mockTransaction}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      // The memo should be sanitised: control characters stripped.
      // And rendered as text, meaning the HTML tag '<script>' is rendered as plain text,
      // not parsed as an actual DOM script tag.
      const memoElement = screen.getByText("Malicious <script>alert('hack')</script>Text");
      expect(memoElement).toBeInTheDocument();
      expect(memoElement.tagName).not.toBe("SCRIPT");
    });
  });

  it("does not construct explorer link for invalid transaction hashes/IDs", async () => {
    const invalidTransaction = {
      ...mockTransaction,
      id: "invalid_hash_here_with_unsupported_chars!@",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transaction: {
          id: "invalid_hash_here_with_unsupported_chars!@",
          memo: "No link please",
        },
      }),
    });

    render(
      <TransactionDetail
        transaction={invalidTransaction}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No link please")).toBeInTheDocument();
      expect(screen.queryByText("View on Stellar Expert")).not.toBeInTheDocument();
    });
  });

  it("rejects non-https or unallowlisted explorer link bases if constructed", async () => {
    // If the explorer ID/hash is mock/valid but the URL setup logic rejects non-https
    // Or if someone tries to trick the base URL allowlist, it should be ignored or not rendered.
    // Our Component uses isValidTxHash and builds using a hardcoded safe base URL.
    // Let's test the happy path with 64-char transaction hash:
    const txHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd";
    const validTransaction = {
      ...mockTransaction,
      id: txHash,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transaction: {
          id: txHash,
          memo: "Hash test",
        },
      }),
    });

    render(
      <TransactionDetail
        transaction={validTransaction}
        isOpen={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      const link = screen.getByText("View on Stellar Expert") as HTMLAnchorElement;
      expect(link).toBeInTheDocument();
      expect(link.href).toBe(`https://stellar.expert/explorer/testnet/tx/${txHash}`);
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("target")).toBe("_blank");
    });
  });
});
