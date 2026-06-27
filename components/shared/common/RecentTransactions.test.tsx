import React from "react";
import { render, screen, waitFor, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecentTransactions } from "./RecentTransactions";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: {
    src: string; alt: string; width: number; height: number; className?: string;
  }) => <img src={src} alt={alt} width={width} height={height} className={className} />,
}));

const mockTransactions = [
  {
    id: "t1",
    type: "Lend",
    amount: 100,
    asset: "XLM",
    date: "2024-01-03",
    time: "10:00",
    status: "Completed",
  },
  {
    id: "t2",
    type: "Borrow",
    amount: -200,
    asset: "USDC",
    date: "2024-01-02",
    time: "11:00",
    status: "Processing",
  },
];

const emptyResponse = { transactions: [], total: 0, nextCursor: null };
const populatedResponse = { transactions: mockTransactions, total: 2, nextCursor: null };

function stubFetch(json: object) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => json }),
  );
}

function stubFetchPending() {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
}

describe("RecentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Section header ───────────────────────────────────────────────────────

  it("always renders the section heading and View All button", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    expect(screen.getByRole("heading", { name: "Recent Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  it("keeps View All button visible while loading", () => {
    stubFetchPending();
    render(<RecentTransactions />);

    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  it("keeps View All button visible in empty state", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No transactions yet" })).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  it("keeps View All button visible in populated state", async () => {
    stubFetch(populatedResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it("shows skeleton while the hook is loading", () => {
    stubFetchPending();
    render(<RecentTransactions />);

    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();
  });

  it("does not show EmptyState while loading", () => {
    stubFetchPending();
    render(<RecentTransactions />);

    expect(
      screen.queryByRole("heading", { name: "No transactions yet" }),
    ).not.toBeInTheDocument();
  });

  // ─── loading → empty transition ───────────────────────────────────────────

  it("transitions from skeleton to EmptyState when feed returns no rows", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    // Initially the skeleton is shown
    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();

    // After the fetch resolves the skeleton is gone and EmptyState appears
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "No transactions yet" }),
      ).toBeInTheDocument(),
    );

    expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument();
  });

  it("renders EmptyState description when feed is empty", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No transactions yet" })).toBeInTheDocument(),
    );

    expect(
      screen.getByText(/your transaction history will appear here/i),
    ).toBeInTheDocument();
  });

  it("renders the Explore lending CTA in empty state", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Explore lending" })).toBeInTheDocument(),
    );
  });

  it("calls router.push('/lending') when Explore lending CTA is clicked", async () => {
    stubFetch(emptyResponse);
    render(<RecentTransactions />);

    const cta = await screen.findByRole("button", { name: "Explore lending" });
    fireEvent.click(cta);

    expect(mockPush).toHaveBeenCalledWith("/lending");
  });

  // ─── loading → populated transition ──────────────────────────────────────

  it("transitions from skeleton to transaction list when feed has rows", async () => {
    stubFetch(populatedResponse);
    render(<RecentTransactions />);

    // Initially loading
    expect(screen.getByLabelText("Loading transactions")).toBeInTheDocument();

    // After load, skeleton is gone and EmptyState is NOT shown
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("heading", { name: "No transactions yet" }),
    ).not.toBeInTheDocument();
  });

  it("does not render EmptyState when transactions are present", async () => {
    stubFetch(populatedResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("heading", { name: "No transactions yet" }),
    ).not.toBeInTheDocument();
  });

  it("renders transaction types from the feed in populated state", async () => {
    stubFetch(populatedResponse);
    render(<RecentTransactions />);

    await waitFor(() =>
      expect(screen.queryByLabelText("Loading transactions")).not.toBeInTheDocument(),
    );

    // Both transaction types should appear in the rendered table/cards
    expect(screen.getAllByText("Lend").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Borrow").length).toBeGreaterThan(0);
  });
});
