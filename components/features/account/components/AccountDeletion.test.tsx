import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AccountDeletion from "./AccountDeletion";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/shared/common/AccountDeletionDialog", () => ({
  default: ({
    isOpen,
    onCancel,
    onConfirmDelete,
  }: {
    isOpen: boolean;
    onCancel: () => void;
    onConfirmDelete: () => Promise<void>;
  }) =>
    isOpen ? (
      <div data-testid="deletion-dialog">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => void onConfirmDelete().catch(() => {})}>
          Confirm Delete
        </button>
      </div>
    ) : null,
}));

global.fetch = vi.fn();

describe("AccountDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders delete section with heading and button", () => {
    render(<AccountDeletion />);
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete My Account" }),
    ).toBeInTheDocument();
  });

  it("does not show dialog initially", () => {
    render(<AccountDeletion />);
    expect(screen.queryByTestId("deletion-dialog")).not.toBeInTheDocument();
  });

  it("shows requesting state during challenge fetch", async () => {
    let resolve!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByText("Requesting...")).toBeInTheDocument(),
    );

    // resolve to avoid act() warning
    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      });
    });
  });

  it("prevents concurrent clicks while fetching", async () => {
    let resolve!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );

    render(<AccountDeletion />);
    const button = screen.getByRole("button", { name: "Delete My Account" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText("Requesting...")).toBeInTheDocument(),
    );

    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("opens dialog on successful challenge fetch", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "challenge-token", expiresAt: "2026-06-29T00:00:00Z" }),
    });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByTestId("deletion-dialog")).toBeInTheDocument(),
    );
  });

  it("shows rate-limit toast on 429 challenge response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: "Too many requests. Please try again later." },
      }),
    });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("deletion-dialog")).not.toBeInTheDocument();
  });

  it("shows generic error toast on other challenge failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByText("Challenge failed")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("deletion-dialog")).not.toBeInTheDocument();
  });

  it("shows network error toast when fetch throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network failure"),
    );

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("dismisses toast after 5 seconds", async () => {
    vi.useFakeTimers();
    try {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("fail"),
      );

      render(<AccountDeletion />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));
      });

      expect(screen.getByText("Network error")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByText("Network error")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes dialog and clears challenge on cancel", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "tok", expiresAt: "" }),
    });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByTestId("deletion-dialog")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByTestId("deletion-dialog")).not.toBeInTheDocument(),
    );
  });

  it("calls DELETE /api/account/delete with challenge on confirm", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "my-challenge", expiresAt: "" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Account deletion initiated" }),
      });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByTestId("deletion-dialog")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/account/delete",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge: "my-challenge" }),
        },
      );
    });
  });

  it("redirects to / on successful deletion", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Account deletion initiated" }),
      });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByTestId("deletion-dialog")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("does not redirect when delete API returns an error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid or expired deletion challenge" }),
      });

    render(<AccountDeletion />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByTestId("deletion-dialog")).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
