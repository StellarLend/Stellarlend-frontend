import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import NotificationPreferences from "./NotificationPreferences";

const defaultPrefs = { email: true, push: true, sms: false, inApp: true };

const makeFetch = (notifications = defaultPrefs) =>
  vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ notifications }),
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("NotificationPreferences", () => {
  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<NotificationPreferences />);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders all four toggle channels after load", async () => {
    global.fetch = makeFetch();
    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("switch", { name: /toggle push/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /toggle sms/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /toggle in-app/i })).toBeInTheDocument();
  });

  it("reflects loaded preference state in toggles", async () => {
    global.fetch = makeFetch({ email: true, push: false, sms: false, inApp: true });
    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toBeInTheDocument()
    );

    expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /toggle push/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /toggle sms/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /toggle in-app/i })).toHaveAttribute("aria-checked", "true");
  });

  it("shows error state when GET rejects", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Network error")
    );
  });

  it("shows error when GET returns non-ok", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    render(<NotificationPreferences />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("optimistically toggles a channel on click", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: { ...defaultPrefs, email: false } }) });

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "true")
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle email/i }));

    // Optimistic update is synchronous
    expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "false");
  });

  it("shows success toast after successful save", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: { ...defaultPrefs, sms: true } }) });

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle sms/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle sms/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/preferences saved/i)
    );
  });

  it("rolls back optimistic toggle on save failure", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "Server error" }) });

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "true")
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle email/i }));
    // Optimistic toggle to false
    expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "false");

    // After failed PUT, rolls back to true
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toHaveAttribute("aria-checked", "true")
    );
    expect(screen.getByRole("status")).toHaveTextContent(/save failed/i);
  });

  it("rolls back and shows error toast on network failure during save", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockRejectedValueOnce(new Error("Network error"));

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle push/i })).toHaveAttribute("aria-checked", "true")
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle push/i }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle push/i })).toHaveAttribute("aria-checked", "true")
    );
    expect(screen.getByRole("status")).toHaveTextContent(/save failed/i);
  });

  it("sends PUT with correct notifications body when toggling", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: { ...defaultPrefs, email: false } }) });

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle email/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        "/api/account/preferences",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ notifications: { ...defaultPrefs, email: false } }),
        })
      )
    );
  });

  it("all-off state: all toggles show aria-checked=false", async () => {
    global.fetch = makeFetch({ email: false, push: false, sms: false, inApp: false });
    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle email/i })).toBeInTheDocument()
    );

    for (const name of ["email", "push", "sms", "in-app"]) {
      expect(
        screen.getByRole("switch", { name: new RegExp(`toggle ${name}`, "i") })
      ).toHaveAttribute("aria-checked", "false");
    }
  });

  it("toast auto-dismisses after 4 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: defaultPrefs }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ notifications: { ...defaultPrefs, inApp: false } }) });

    render(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /toggle in-app/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("switch", { name: /toggle in-app/i }));

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    act(() => vi.advanceTimersByTime(4000));

    await waitFor(() =>
      expect(screen.queryByText(/preferences saved/i)).not.toBeInTheDocument()
    );
  });
});
