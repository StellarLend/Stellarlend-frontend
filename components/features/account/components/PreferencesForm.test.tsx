import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import PreferencesForm from "./PreferencesForm";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPreferences = {
  locale: "en-US",
  displayCurrency: "USD",
  notifications: { email: true, push: true, sms: false, inApp: true },
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
  it("renders all form fields", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    expect(await screen.findByLabelText("Locale")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Currency")).toBeInTheDocument();
    expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Push notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("SMS")).toBeInTheDocument();
    expect(screen.getByLabelText("In-app notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Preferences" })).toBeInTheDocument();
  });

  it("shows validation errors when locale is empty", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    const locale = screen.getByLabelText("Locale") as HTMLSelectElement;
    fireEvent.change(locale, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Locale is required.")).toBeInTheDocument();
  });

  it("shows required errors for both empty locale and empty currency", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    const locale = screen.getByLabelText("Locale") as HTMLSelectElement;
    fireEvent.change(locale, { target: { value: "" } });
    const currency = screen.getByLabelText("Display Currency") as HTMLSelectElement;
    fireEvent.change(currency, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(await screen.findByText("Locale is required.")).toBeInTheDocument();
    expect(screen.getByText("Display currency is required.")).toBeInTheDocument();
  });

  it("calls the preferences API with the expected payload on save", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    const fetchMock = mockFetchOnce(mockPreferences);

    const locale = screen.getByLabelText("Locale") as HTMLSelectElement;
    fireEvent.change(locale, { target: { value: "fr" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: "fr",
          displayCurrency: "USD",
          notifications: { email: true, push: true, sms: false, inApp: true },
        }),
      });
    });
  });

  it("shows a success confirmation after saving", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    mockFetchOnce(mockPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(
      await screen.findByText("Preferences saved successfully.")
    ).toBeInTheDocument();
  });

  it("shows an error banner when the save fails", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    mockFetchOnce(null, 500);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(
      await screen.findByText("Failed to save preferences. Please try again.")
    ).toBeInTheDocument();
  });

  it("submits without changes when the form is already valid", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    const fetchMock = mockFetchOnce(mockPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText("Preferences saved successfully.")
    ).toBeInTheDocument();
  });

  it("announces save status accessibly", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    mockFetchOnce(mockPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Preferences saved successfully.");
  });

  it("shows field errors returned from the API (422)", async () => {
    mockFetchOnce(mockPreferences);
    render(<PreferencesForm />);

    await screen.findByLabelText("Locale");

    const apiErrors = { locale: "Unsupported locale value." };
    mockFetchOnce({ errors: apiErrors }, 422);

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(
      await screen.findByText("Unsupported locale value.")
    ).toBeInTheDocument();
  });
});
