import { render, screen, waitFor, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PreferencesForm from "./PreferencesForm";

const mockPreferences = {
  userId: "user-1",
  email: "alice@example.com",
  locale: "en-US",
  displayCurrency: "USD",
  notifications: { email: true, push: true, sms: false, inApp: true },
  updatedAt: null,
};

describe("PreferencesForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPreferences,
    }) as unknown as typeof fetch;
  });

  it("loads and renders current preferences", async () => {
    render(<PreferencesForm />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("alice@example.com")).toBeTruthy();
    });
    expect(screen.getByLabelText(/Language \/ Locale/i)).toBeTruthy();
    expect(screen.getByLabelText(/Display Currency/i)).toBeTruthy();
  });

  it("shows validation error for invalid email on save", async () => {
    render(<PreferencesForm />);
    await waitFor(() => screen.getByDisplayValue("alice@example.com"));

    fireEvent.change(screen.getByDisplayValue("alice@example.com"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email address")).toBeTruthy();
    });
  });
});
