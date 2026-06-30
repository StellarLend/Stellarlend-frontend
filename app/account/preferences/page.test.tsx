import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PreferencesPage from "./page";

// Mock the Sidebar component to avoid dependencies
vi.mock("@/components/shared/layout/Sidebar", () => ({
  default: () => <nav data-testid="sidebar" />,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/account/preferences",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock SidebarContext
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    isSidebarOpen: true,
    isMobile: false,
    toggleSidebar: vi.fn(),
    closeSidebar: vi.fn(),
  }),
}));

const mockPrefs = {
  userId: "user-1",
  email: "test@example.com",
  locale: "en-US",
  displayCurrency: "USD",
  notifications: { email: true, push: true, sms: false, inApp: true },
  updatedAt: null,
};

describe("PreferencesPage and PreferencesForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPrefs,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the page layout, sidebar and header", async () => {
    render(<PreferencesPage />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage your display currency, language\/locale, and notification settings/i)
    ).toBeInTheDocument();
  });

  it("displays loading state and then pre-populates form controls", async () => {
    render(<PreferencesPage />);
    expect(screen.getByTestId("preferences-loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId("preferences-loading")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("email-input")).toHaveValue("test@example.com");
    expect(screen.getByTestId("locale-select")).toHaveValue("en-US");
    expect(screen.getByTestId("currency-select")).toHaveValue("USD");
    expect(screen.getByTestId("notification-toggle-email")).toBeChecked();
    expect(screen.getByTestId("notification-toggle-push")).toBeChecked();
    expect(screen.getByTestId("notification-toggle-sms")).not.toBeChecked();
    expect(screen.getByTestId("notification-toggle-inApp")).toBeChecked();
  });

  it("handles load failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network Error"));
    render(<PreferencesPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load preferences")).toBeInTheDocument();
    });
  });

  it("handles client-side email validation error on save", async () => {
    render(<PreferencesPage />);
    await waitFor(() => expect(screen.queryByTestId("preferences-loading")).not.toBeInTheDocument());

    const emailInput = screen.getByTestId("email-input");
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });

    const saveBtn = screen.getByTestId("save-preferences-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  it("handles server-side validation error (422 status)", async () => {
    render(<PreferencesPage />);
    await waitFor(() => expect(screen.queryByTestId("preferences-loading")).not.toBeInTheDocument());

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        errors: {
          locale: "Unsupported language option",
        },
      }),
    });

    const saveBtn = screen.getByTestId("save-preferences-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Unsupported language option")).toBeInTheDocument();
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });
  });

  it("saves preferences successfully and shows Toast", async () => {
    render(<PreferencesPage />);
    await waitFor(() => expect(screen.queryByTestId("preferences-loading")).not.toBeInTheDocument());

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...mockPrefs,
        email: "new@example.com",
        locale: "fr",
      }),
    });

    const emailInput = screen.getByTestId("email-input");
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });

    const localeSelect = screen.getByTestId("locale-select");
    fireEvent.change(localeSelect, { target: { value: "fr" } });

    const saveBtn = screen.getByTestId("save-preferences-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Preferences saved")).toBeInTheDocument();
    });
  });

  it("triggers unsaved changes warning on beforeunload when form is dirty", async () => {
    render(<PreferencesPage />);
    await waitFor(() => expect(screen.queryByTestId("preferences-loading")).not.toBeInTheDocument());

    // Clean form: beforeunload should not be prevented
    const cleanEvent = new Event("beforeunload", { bubbles: true, cancelable: true });
    Object.defineProperty(cleanEvent, "returnValue", {
      writable: true,
      value: "",
    });
    const cleanSpy = vi.spyOn(cleanEvent, "preventDefault");
    window.dispatchEvent(cleanEvent);
    expect(cleanSpy).not.toHaveBeenCalled();

    // Dirty the form (change email)
    const emailInput = screen.getByTestId("email-input");
    fireEvent.change(emailInput, { target: { value: "dirty@example.com" } });

    const dirtyEvent = new Event("beforeunload", { bubbles: true, cancelable: true });
    Object.defineProperty(dirtyEvent, "returnValue", {
      writable: true,
      value: "",
    });
    const dirtySpy = vi.spyOn(dirtyEvent, "preventDefault");
    window.dispatchEvent(dirtyEvent);

    expect(dirtySpy).toHaveBeenCalled();
    expect(dirtyEvent.returnValue).toBeTruthy();
  });
});
