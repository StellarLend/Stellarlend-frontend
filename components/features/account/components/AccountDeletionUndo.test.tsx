import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AccountDeletion from "./AccountDeletion";

const makeChallengeResponse = (challenge = "123456", expiresInMs = 60000) => ({
  ok: true,
  json: async () => ({
    challenge,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  }),
});

const makeDeleteResponse = (success = true) => ({
  ok: success,
  status: success ? 200 : 400,
  json: async () =>
    success
      ? { message: "Account deletion initiated" }
      : { error: "Invalid or expired deletion challenge" },
});

const mockFetch = (responses: Array<ReturnType<typeof makeChallengeResponse> | ReturnType<typeof makeDeleteResponse>>) => {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex += 1;
    return Promise.resolve(response);
  });
};

describe("AccountDeletion undo window", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the delete account trigger", () => {
    global.fetch = vi.fn();
    render(<AccountDeletion />);
    expect(screen.getByTestId("delete-account-button")).toBeInTheDocument();
    expect(screen.getByText(/permanently delete your account/i)).toBeInTheDocument();
  });

  it("requests a challenge and opens the modal when triggered", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));

    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );
    expect(screen.getByTestId("challenge-code")).toHaveTextContent("123456");
    expect(global.fetch).toHaveBeenCalledWith("/api/account/delete/challenge");
  });

  it("shows an error when the challenge request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));

    await waitFor(() =>
      expect(screen.getByTestId("account-deletion-error")).toHaveTextContent(
        /server error/i
      )
    );
  });

  it("shows an error for an invalid challenge code", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "wrong-code" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("account-deletion-error")).toHaveTextContent(
        /invalid challenge code/i
      )
    );
  });

  it("shows an error when the challenge has expired", async () => {
    global.fetch = mockFetch([makeChallengeResponse("123456", -1000)]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("account-deletion-error")).toHaveTextContent(
        /challenge has expired/i
      )
    );
  });

  it("enters undo window after a valid confirmation", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );
    expect(screen.getByText(/10s/)).toBeInTheDocument();
  });

  it("counts down visibly during the undo window", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByText(/10s/)).toBeInTheDocument()
    );

    act(() => vi.advanceTimersByTime(3000));

    await waitFor(() => expect(screen.getByText(/7s/)).toBeInTheDocument());
  });

  it("aborts deletion and returns to confirmation when Undo is clicked", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("undo-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("confirm-delete-button")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("undo-delete-button")).not.toBeInTheDocument();
  });

  it("does not call delete endpoint while undo window is active", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    act(() => vi.advanceTimersByTime(5000));

    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/account/delete",
      expect.anything()
    );
  });

  it("finalizes deletion after the undo window elapses", async () => {
    global.fetch = mockFetch([
      makeChallengeResponse(),
      makeDeleteResponse(true),
      { ok: true, status: 200, json: async () => ({}) }, // logout
    ]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    act(() => vi.advanceTimersByTime(10000));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/account/delete",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ challenge: "123456" }),
        })
      )
    );
  });

  it("displays an error when deletion request fails", async () => {
    global.fetch = mockFetch([
      makeChallengeResponse(),
      makeDeleteResponse(false),
    ]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    act(() => vi.advanceTimersByTime(10000));

    await waitFor(() =>
      expect(screen.getByTestId("account-deletion-error")).toHaveTextContent(
        /invalid or expired deletion challenge/i
      )
    );
  });

  it("cleans up timers on unmount during undo window", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    const { unmount } = render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    unmount();

    act(() => vi.advanceTimersByTime(15000));

    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/account/delete",
      expect.anything()
    );
  });

  it("announces status changes to screen readers", async () => {
    global.fetch = mockFetch([makeChallengeResponse()]);
    render(<AccountDeletion />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
        /challenge received/i
      )
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
        /will be finalized in 10 seconds/i
      )
    );
  });

  it("calls onDeleted callback when deletion succeeds", async () => {
    const onDeleted = vi.fn();
    global.fetch = mockFetch([
      makeChallengeResponse(),
      makeDeleteResponse(true),
      { ok: true, status: 200, json: async () => ({}) }, // logout
    ]);
    render(<AccountDeletion onDeleted={onDeleted} />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("challenge-input")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByTestId("challenge-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("undo-delete-button")).toBeInTheDocument()
    );

    act(() => vi.advanceTimersByTime(10000));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
