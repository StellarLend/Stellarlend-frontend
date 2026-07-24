import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import PreferencesForm from "./PreferencesForm";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPreferences = {
  userId: "user-1",
  email: "test@example.com",
  locale: "en-US",
  displayCurrency: "USD",
  notifications: { email: true, push: true, sms: false, inApp: true },
  updatedAt: "2026-06-29T12:00:00Z",
};

function mockFetchOnce(data: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PreferencesForm", () => {
  it("renders loading state initially then all form fields after data load", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    expect(screen.getByText("Loading preferences...")).toBeInTheDocument();

    expect(await screen.findByLabelText("Language / Locale")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Currency")).toBeInTheDocument();
    expect(screen.getByText("Notification Channels")).toBeInTheDocument();
    expect(screen.getByLabelText("Notification Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Preferences" })).toBeInTheDocument();
  });

  it("shows a toast when the save fails (500)", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    mockFetchOnce(null, 500);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(
      screen.getByText("An error occurred while saving your preferences.")
    ).toBeInTheDocument();
  });

  it("calls the preferences API with the expected payload on save", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    const fetchMock = mockFetchOnce(mockPreferences);

    const locale = screen.getByLabelText("Language / Locale") as HTMLSelectElement;
    fireEvent.change(locale, { target: { value: "fr" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          locale: "fr",
          displayCurrency: "USD",
          notifications: { email: true, push: true, sms: false, inApp: true },
        }),
      });
    });
  });

  it("shows a success toast after saving", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    mockFetchOnce(mockPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(
      await screen.findByText("Preferences saved")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your preferences have been updated.")
    ).toBeInTheDocument();
  });

  it("shows validation toast for 422 API errors", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    mockFetchOnce({ errors: { locale: "Unsupported locale value." } }, 422);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(
      screen.getByText("Please fix the highlighted fields.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("locale-error")).toHaveTextContent("Unsupported locale value.");
  });

  it("submits without changes when the form is already valid", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    const fetchMock = mockFetchOnce(mockPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText("Preferences saved")
    ).toBeInTheDocument();
  });

  it("shows inline validation error for invalid email", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Language / Locale");

    const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(
      await screen.findByText("Invalid email address")
    ).toBeInTheDocument();
  });

  it("renders all notification toggle checkboxes", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByText("Notification Channels");

    expect(screen.getByTestId("notification-channel-email")).toBeInTheDocument();
    expect(screen.getByTestId("notification-channel-push")).toBeInTheDocument();
    expect(screen.getByTestId("notification-channel-sms")).toBeInTheDocument();
    expect(screen.getByTestId("notification-channel-inApp")).toBeInTheDocument();
  });

  it("toggles a notification channel on click", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByText("Notification Channels");

    const emailToggle = screen.getByTestId("notification-toggle-email") as HTMLInputElement;
    expect(emailToggle.checked).toBe(true);

    fireEvent.click(emailToggle);
    expect(emailToggle.checked).toBe(false);
  });
});
