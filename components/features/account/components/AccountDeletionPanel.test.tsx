import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AccountDeletionPanel from "./AccountDeletionPanel";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockShowToast = vi.fn();
vi.mock("@/components/shared/common/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

global.fetch = vi.fn();

const CONFIRMATION_PHRASE = "DELETE";

describe("AccountDeletionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders delete section with heading and button", () => {
    render(<AccountDeletionPanel />);
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete My Account" }),
    ).toBeInTheDocument();
  });

  it("does not show dialog initially", () => {
    render(<AccountDeletionPanel />);
    expect(
      screen.queryByRole("dialog"),
    ).not.toBeInTheDocument();
  });

  it("shows requesting state during challenge fetch", async () => {
    let resolve!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByText("Requesting...")).toBeInTheDocument(),
    );

    await act(async () => {
      resolve({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      });
    });
  });

  it("prevents concurrent clicks while fetching challenge", async () => {
    let resolve!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );

    render(<AccountDeletionPanel />);
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
      json: async () => ({
        challenge: "challenge-token",
        expiresAt: "2026-06-29T00:00:00Z",
      }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("dialog has input field labeled with confirmation phrase", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "tok", expiresAt: "" }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(`Type "${CONFIRMATION_PHRASE}" to confirm`),
      ).toBeInTheDocument();
    });
  });

  it("shows rate-limit toast on 429 challenge response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: "Too many requests. Please try again later." },
      }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Rate limit exceeded",
        description: "Too many requests. Please try again later.",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows generic error toast on other challenge failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Challenge failed",
        description: "Could not start deletion. Please try again.",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows network error toast when challenge fetch throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network failure"),
    );

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Network error",
        description: "Could not reach the server. Check your connection.",
      }),
    );
  });

  it("closes dialog and clears state on cancel", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "tok", expiresAt: "" }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("delete button is disabled when typed phrase does not match", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "tok", expiresAt: "" }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const dialogDeleteButton = screen.getByTestId("confirm-delete-button");
    expect(dialogDeleteButton).toBeDisabled();

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "delet" } });
    expect(dialogDeleteButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(dialogDeleteButton).toBeEnabled();
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

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

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

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error toast when delete API fails", async () => {
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

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Deletion failed",
        description: "Invalid or expired deletion challenge",
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error toast when delete API returns unknown error shape", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Deletion failed",
        description: "Account deletion failed. Please try again.",
      });
    });
  });

  it("shows network error toast when delete fetch throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockRejectedValueOnce(new Error("Network failure"));

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Network error",
        description: "Could not reach the server. Check your connection.",
      });
    });
  });

  it("prevents double-submit during deletion", async () => {
    let resolveDelete!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockImplementation(
        () => new Promise((r) => { resolveDelete = r; }),
      );

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    const deleteButton = screen.getByTestId("confirm-delete-button");
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveDelete({
        ok: true,
        json: async () => ({ message: "Account deletion initiated" }),
      });
    });
  });

  it("shows Deleting... state during deletion", async () => {
    let resolveDelete!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockImplementation(
        () => new Promise((r) => { resolveDelete = r; }),
      );

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByText("Deleting...")).toBeInTheDocument(),
    );

    await act(async () => {
      resolveDelete({
        ok: true,
        json: async () => ({ message: "Account deletion initiated" }),
      });
    });
  });

  it("closes dialog and clears input on successful deletion", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ challenge: "tok", expiresAt: "" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Account deletion initiated" }),
      });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("does not redirect when delete API fails", async () => {
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

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(
      `Type "${CONFIRMATION_PHRASE}" to confirm`,
    );
    fireEvent.change(input, { target: { value: "DELETE" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-delete-button"));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Escape key closes the dialog", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ challenge: "tok", expiresAt: "" }),
    });

    render(<AccountDeletionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );

    fireEvent.keyDown(document.activeElement || document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
