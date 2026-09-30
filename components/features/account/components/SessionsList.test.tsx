import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import SessionsList, {
  describeDevice,
  formatLastActive,
} from "./SessionsList";

const NOW = new Date("2026-06-29T12:00:00.000Z").getTime();

const currentSession = {
  id: "sess-current",
  current: true,
  device: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36",
    ipAddress: "203.0.113.10",
  },
  createdAt: "2026-06-29T09:00:00.000Z",
  lastSeenAt: "2026-06-29T11:59:30.000Z",
};

const otherSession = {
  id: "sess-other",
  current: false,
  device: {
    userAgent: "Mozilla/5.0 (Linux; Android 14) Firefox/121.0",
    ipAddress: "198.51.100.4",
  },
  createdAt: "2026-06-20T09:00:00.000Z",
  lastSeenAt: "2026-06-28T12:00:00.000Z",
};

function mockListOnce(sessions: unknown[]) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ sessions }),
  });
}

describe("SessionsList", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state before sessions resolve", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<SessionsList />);

    expect(
      screen.getByLabelText("Loading active sessions"),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("session-skeleton").length).toBeGreaterThan(0);
  });

  it("renders the empty state when there are no sessions", async () => {
    mockListOnce([]);

    render(<SessionsList />);

    expect(
      await screen.findByText("You have no other active sessions."),
    ).toBeInTheDocument();
  });

  it("renders sessions with a device label, IP and current badge", async () => {
    mockListOnce([currentSession, otherSession]);

    render(<SessionsList />);

    expect(await screen.findByText("Chrome on macOS")).toBeInTheDocument();
    expect(screen.getByText("Firefox on Android")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.10/)).toBeInTheDocument();
  });

  it("shows an error state with a working retry button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    render(<SessionsList />);

    expect(
      await screen.findByText("We couldn't load your active sessions."),
    ).toBeInTheDocument();

    // Retry succeeds and replaces the error with the list.
    mockListOnce([otherSession]);
    fireEvent.click(screen.getByText("Try again"));

    expect(await screen.findByText("Firefox on Android")).toBeInTheDocument();
  });

  it("treats a thrown fetch (network failure) as an error state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );

    render(<SessionsList />);

    expect(
      await screen.findByText("We couldn't load your active sessions."),
    ).toBeInTheDocument();
  });

  it("revokes a non-current session without a confirm flag", async () => {
    mockListOnce([otherSession]);

    render(<SessionsList />);
    await screen.findByText("Firefox on Android");

    fireEvent.click(
      screen.getByRole("button", { name: /Revoke Firefox on Android/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Revoke this session?"),
    ).toBeInTheDocument();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: true }),
    });

    fireEvent.click(within(dialog).getByText("Revoke session"));

    await waitFor(() => {
      expect(screen.queryByText("Firefox on Android")).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/account/sessions/sess-other",
      { method: "DELETE" },
    );
  });

  it("warns about and confirm-revokes the current session", async () => {
    mockListOnce([currentSession]);

    render(<SessionsList />);
    await screen.findByText("Chrome on macOS");

    fireEvent.click(
      screen.getByRole("button", { name: /current session/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/This is your current session\./),
    ).toBeInTheDocument();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: true }),
    });

    fireEvent.click(within(dialog).getByText("Revoke session"));

    await waitFor(() => {
      expect(screen.queryByText("Chrome on macOS")).not.toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/account/sessions/sess-current?confirm=true",
      { method: "DELETE" },
    );
  });

  it("surfaces an error inside the modal when revoke fails", async () => {
    mockListOnce([otherSession]);

    render(<SessionsList />);
    await screen.findByText("Firefox on Android");

    fireEvent.click(
      screen.getByRole("button", { name: /Revoke Firefox on Android/ }),
    );

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "boom" }),
    });

    fireEvent.click(screen.getByText("Revoke session"));

    expect(
      await screen.findByText(
        "Could not revoke the session. Please try again.",
      ),
    ).toBeInTheDocument();
    // Session stays in the list when revoke fails.
    expect(screen.getByText("Firefox on Android")).toBeInTheDocument();
  });

  it("surfaces an error inside the modal when revoke throws", async () => {
    mockListOnce([otherSession]);

    render(<SessionsList />);
    await screen.findByText("Firefox on Android");

    fireEvent.click(
      screen.getByRole("button", { name: /Revoke Firefox on Android/ }),
    );

    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );

    fireEvent.click(screen.getByText("Revoke session"));

    expect(
      await screen.findByText(
        "Could not revoke the session. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("closes the modal on cancel without revoking", async () => {
    mockListOnce([otherSession]);

    render(<SessionsList />);
    await screen.findByText("Firefox on Android");

    fireEvent.click(
      screen.getByRole("button", { name: /Revoke Firefox on Android/ }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Firefox on Android")).toBeInTheDocument();
    // Only the initial list fetch happened — no DELETE.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to an empty list when the payload is malformed", async () => {
    mockListOnce(undefined as unknown as unknown[]);

    render(<SessionsList />);

    expect(
      await screen.findByText("You have no other active sessions."),
    ).toBeInTheDocument();
  });
});

describe("describeDevice", () => {
  it("returns a fallback for a missing user agent", () => {
    expect(describeDevice(null)).toBe("Unknown device");
  });

  it("combines browser and OS when both are present", () => {
    expect(
      describeDevice("Mozilla/5.0 (Windows NT 10.0) Edg/120.0"),
    ).toBe("Edge on Windows");
  });

  it("returns the browser alone when the OS is unknown", () => {
    expect(describeDevice("SomeAgent Firefox/121.0")).toBe("Firefox");
  });

  it("returns the OS alone when the browser is unknown", () => {
    expect(describeDevice("CustomBot (iPhone; iOS 17)")).toBe("iOS");
  });

  it("returns a fallback when nothing is recognised", () => {
    expect(describeDevice("totally-unknown-agent")).toBe("Unknown device");
  });
});

describe("formatLastActive", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles just-now, minutes, hours and days", () => {
    expect(formatLastActive("2026-06-29T11:59:40.000Z")).toBe("Just now");
    expect(formatLastActive("2026-06-29T11:58:00.000Z")).toBe("2 minutes ago");
    expect(formatLastActive("2026-06-29T11:00:00.000Z")).toBe("1 hour ago");
    expect(formatLastActive("2026-06-27T12:00:00.000Z")).toBe("2 days ago");
  });

  it("returns Unknown for an invalid timestamp", () => {
    expect(formatLastActive("not-a-date")).toBe("Unknown");
  });
});
