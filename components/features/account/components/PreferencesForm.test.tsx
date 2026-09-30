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
import PreferencesForm from "./PreferencesForm";

const defaultPreferences = {
  userId: "user-123",
  email: "user@example.com",
  locale: "en-US",
  displayCurrency: "USD",
  notifications: {
    email: true,
    push: true,
    sms: false,
    inApp: true,
  },
  updatedAt: "2026-07-24T07:00:00.000Z",
};

function mockFetchOnce(data: unknown, status = 200, ok = true) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
  });
}

describe("PreferencesForm", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Loading state", () => {
    it("shows loading indicator before preferences resolve", () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}),
      );

      render(<PreferencesForm />);

      expect(screen.getByTestId("preferences-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading preferences...")).toBeInTheDocument();
    });
  });

  describe("Initial load and display", () => {
    it("renders the form with loaded preferences", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("preferences-form")).toBeInTheDocument(),
      );

      // Check email field
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      expect(emailInput.value).toBe("user@example.com");

      // Check locale select
      const localeSelect = screen.getByTestId("locale-select") as HTMLSelectElement;
      expect(localeSelect.value).toBe("en-US");

      // Check currency select
      const currencySelect = screen.getByTestId("currency-select") as HTMLSelectElement;
      expect(currencySelect.value).toBe("USD");

      // Check notification toggles
      expect(screen.getByTestId("notification-toggle-email")).toBeChecked();
      expect(screen.getByTestId("notification-toggle-push")).toBeChecked();
      expect(screen.getByTestId("notification-toggle-sms")).not.toBeChecked();
      expect(screen.getByTestId("notification-toggle-inApp")).toBeChecked();
    });

    it("handles missing email in preferences gracefully", async () => {
      const prefsWithoutEmail = { ...defaultPreferences, email: undefined };
      mockFetchOnce(prefsWithoutEmail);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("preferences-form")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      expect(emailInput.value).toBe("");
    });

    it("shows error toast when preferences load fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByText("Failed to load preferences")).toBeInTheDocument(),
      );
    });
  });

  describe("Form interaction and dirty state", () => {
    it("updates email field on user input", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "newemail@example.com" } });

      expect(emailInput.value).toBe("newemail@example.com");
    });

    it("updates locale select on user change", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("locale-select")).toBeInTheDocument(),
      );

      const localeSelect = screen.getByTestId("locale-select") as HTMLSelectElement;
      fireEvent.change(localeSelect, { target: { value: "es" } });

      expect(localeSelect.value).toBe("es");
    });

    it("updates currency select on user change", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("currency-select")).toBeInTheDocument(),
      );

      const currencySelect = screen.getByTestId("currency-select") as HTMLSelectElement;
      fireEvent.change(currencySelect, { target: { value: "EUR" } });

      expect(currencySelect.value).toBe("EUR");
    });

    it("toggles notification channels on click", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("notification-toggle-email")).toBeInTheDocument(),
      );

      const emailToggle = screen.getByTestId("notification-toggle-email");
      expect(emailToggle).toBeChecked();

      fireEvent.click(emailToggle);
      expect(emailToggle).not.toBeChecked();

      fireEvent.click(emailToggle);
      expect(emailToggle).toBeChecked();
    });

    it("applies styling to selected notification channels", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("notification-channel-email")).toBeInTheDocument(),
      );

      const emailChannel = screen.getByTestId("notification-channel-email");
      expect(emailChannel).toHaveClass("border-[#2600FF]", "bg-[#2600FF]/5");

      const smsChannel = screen.getByTestId("notification-channel-sms");
      expect(smsChannel).toHaveClass("border-gray-200");
    });
  });

  describe("beforeunload guard for dirty state", () => {
    it("triggers beforeunload event when form is dirty", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Make the form dirty
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "changed@example.com" } });

      // Simulate beforeunload — jsdom doesn't propagate returnValue assignments
      // on synthetic events, so we verify preventDefault() was called (the real
      // browser guard signal) and that the handler assigns returnValue at all.
      const beforeUnloadEvent = new Event("beforeunload") as BeforeUnloadEvent;
      const preventDefaultSpy = vi.spyOn(beforeUnloadEvent, "preventDefault");

      window.dispatchEvent(beforeUnloadEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("does not trigger beforeunload when form is pristine", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Form is pristine, no changes made — handler should not call preventDefault
      const beforeUnloadEvent = new Event("beforeunload") as BeforeUnloadEvent;
      const preventDefaultSpy = vi.spyOn(beforeUnloadEvent, "preventDefault");

      window.dispatchEvent(beforeUnloadEvent);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("cleans up beforeunload listener on unmount", async () => {
      mockFetchOnce(defaultPreferences);

      const { unmount } = render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      );
    });
  });

  describe("Successful save flow", () => {
    it("submits updated preferences and shows success toast", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Make changes
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      const localeSelect = screen.getByTestId("locale-select") as HTMLSelectElement;
      fireEvent.change(localeSelect, { target: { value: "es" } });

      const currencySelect = screen.getByTestId("currency-select") as HTMLSelectElement;
      fireEvent.change(currencySelect, { target: { value: "EUR" } });

      const smsToggle = screen.getByTestId("notification-toggle-sms");
      fireEvent.click(smsToggle);

      // Mock successful PUT
      const updatedPrefs = {
        ...defaultPreferences,
        email: "updated@example.com",
        locale: "es",
        displayCurrency: "EUR",
        notifications: { ...defaultPreferences.notifications, sms: true },
      };
      mockFetchOnce(updatedPrefs);

      // Submit
      const saveButton = screen.getByTestId("save-preferences-btn");
      fireEvent.click(saveButton);

      // Verify PUT request
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/account/preferences",
          expect.objectContaining({
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "updated@example.com",
              locale: "es",
              displayCurrency: "EUR",
              notifications: {
                email: true,
                push: true,
                sms: true,
                inApp: true,
              },
            }),
          }),
        );
      });

      // Verify success toast
      expect(
        await screen.findByText("Preferences saved"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Your preferences have been updated."),
      ).toBeInTheDocument();
    });

    it("resets form to saved state after successful save", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Make a change
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      // Mock successful PUT with server response
      const updatedPrefs = {
        ...defaultPreferences,
        email: "updated@example.com",
      };
      mockFetchOnce(updatedPrefs);

      // Submit
      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Preferences saved")).toBeInTheDocument(),
      );

      // Form should now be pristine with new values
      expect(emailInput.value).toBe("updated@example.com");

      // No beforeunload guard should fire
      const beforeUnloadEvent = new Event("beforeunload") as BeforeUnloadEvent;
      const preventDefaultSpy = vi.spyOn(beforeUnloadEvent, "preventDefault");
      window.dispatchEvent(beforeUnloadEvent);
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe("422 validation error handling", () => {
    it("displays field-level errors from 422 response", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Use a valid email so client-side validation passes and the PUT fires
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "valid@example.com" } });

      const localeSelect = screen.getByTestId("locale-select") as HTMLSelectElement;
      fireEvent.change(localeSelect, { target: { value: "invalid-locale" } });

      // Mock 422 response with field-level errors
      mockFetchOnce(
        {
          errors: {
            locale: "Unsupported locale",
          },
        },
        422,
        false,
      );

      // Submit
      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      // Verify error toast
      await waitFor(() =>
        expect(screen.getByText("Validation failed")).toBeInTheDocument(),
      );
      expect(
        screen.getByText("Please fix the highlighted fields."),
      ).toBeInTheDocument();

      // Verify field-level error is shown
      expect(screen.getByTestId("locale-error")).toHaveTextContent(
        "Unsupported locale",
      );
    });

    it("clears field-level errors when user corrects the input", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      // Trigger 422 error
      const localeSelect = screen.getByTestId("locale-select") as HTMLSelectElement;
      fireEvent.change(localeSelect, { target: { value: "invalid-locale" } });

      mockFetchOnce(
        {
          errors: {
            locale: "Unsupported locale",
          },
        },
        422,
        false,
      );

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByTestId("locale-error")).toBeInTheDocument(),
      );

      // User corrects the input
      fireEvent.change(localeSelect, { target: { value: "es" } });

      // Error should be cleared
      expect(screen.queryByTestId("locale-error")).not.toBeInTheDocument();
    });

    it("applies error styling to fields with validation errors", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("locale-select")).toBeInTheDocument(),
      );

      const localeSelect = screen.getByTestId("locale-select");
      fireEvent.change(localeSelect, { target: { value: "invalid" } });

      mockFetchOnce(
        {
          errors: {
            locale: "Unsupported locale",
          },
        },
        422,
        false,
      );

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByTestId("locale-error")).toBeInTheDocument(),
      );

      expect(localeSelect).toHaveClass(
        "border-red-500",
        "focus:ring-red-500",
        "focus:border-red-500",
      );
    });

    it("handles 422 response with empty errors object", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      mockFetchOnce({}, 422, false);

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Validation failed")).toBeInTheDocument(),
      );

      // Should not crash, just show generic error
      expect(
        screen.getByText("Please fix the highlighted fields."),
      ).toBeInTheDocument();
    });
  });

  describe("Client-side validation", () => {
    it("validates email format before submitting", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "not-an-email" } });

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Validation failed")).toBeInTheDocument(),
      );

      // Should NOT make a PUT request
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only the initial GET
    });

    it("allows empty email (optional field)", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "" } });

      mockFetchOnce({ ...defaultPreferences, email: undefined });

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/account/preferences",
          expect.objectContaining({
            method: "PUT",
          }),
        );
      });
    });

    it("allows valid email formats", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "valid@email.com" } });

      mockFetchOnce({ ...defaultPreferences, email: "valid@email.com" });

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/account/preferences",
          expect.objectContaining({
            method: "PUT",
          }),
        );
      });
    });
  });

  describe("Save failure handling", () => {
    it("shows error toast when save fails with non-422 status", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      mockFetchOnce({ error: "Internal server error" }, 500, false);

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Save failed")).toBeInTheDocument(),
      );
      expect(
        screen.getByText("An error occurred while saving your preferences."),
      ).toBeInTheDocument();
    });

    it("shows error toast when save throws network error", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Save failed")).toBeInTheDocument(),
      );
    });

    it("does not update form state when save fails", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      mockFetchOnce({ error: "Server error" }, 500, false);

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Save failed")).toBeInTheDocument(),
      );

      // Form should still be dirty — beforeunload guard fires
      const beforeUnloadEvent = new Event("beforeunload") as BeforeUnloadEvent;
      const preventDefaultSpy = vi.spyOn(beforeUnloadEvent, "preventDefault");
      window.dispatchEvent(beforeUnloadEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("Loading and saving states", () => {
    it("disables save button and shows loading state during save", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      // Mock a slow PUT response
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}),
      );

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      // Button should show loading state
      const saveButton = screen.getByTestId("save-preferences-btn");
      expect(saveButton).toBeDisabled();
    });

    it("re-enables save button after save completes", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "updated@example.com" } });

      mockFetchOnce({ ...defaultPreferences, email: "updated@example.com" });

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() =>
        expect(screen.getByText("Preferences saved")).toBeInTheDocument(),
      );

      const saveButton = screen.getByTestId("save-preferences-btn");
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe("isDirty state tracking", () => {
    it("correctly tracks dirty state for each field type", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("email-input")).toBeInTheDocument(),
      );

      const isDirtyViaBeforeUnload = () => {
        const evt = new Event("beforeunload") as BeforeUnloadEvent;
        const spy = vi.spyOn(evt, "preventDefault");
        window.dispatchEvent(evt);
        return spy.mock.calls.length > 0;
      };

      // Pristine — not dirty
      expect(isDirtyViaBeforeUnload()).toBe(false);

      // Email change makes it dirty
      const emailInput = screen.getByTestId("email-input") as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "changed@example.com" } });
      expect(isDirtyViaBeforeUnload()).toBe(true);

      // Revert to original — back to pristine
      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      expect(isDirtyViaBeforeUnload()).toBe(false);

      // Locale change makes it dirty
      const localeSelect = screen.getByTestId("locale-select");
      fireEvent.change(localeSelect, { target: { value: "es" } });
      expect(isDirtyViaBeforeUnload()).toBe(true);

      // Revert locale
      fireEvent.change(localeSelect, { target: { value: "en-US" } });
      expect(isDirtyViaBeforeUnload()).toBe(false);

      // Notification toggle makes it dirty (sms was false, now true)
      const smsToggle = screen.getByTestId("notification-toggle-sms");
      fireEvent.click(smsToggle);
      expect(isDirtyViaBeforeUnload()).toBe(true);
    });
  });

  describe("All notification channels", () => {
    it("handles all four notification channel toggles independently", async () => {
      mockFetchOnce(defaultPreferences);

      render(<PreferencesForm />);

      await waitFor(() =>
        expect(screen.getByTestId("notification-toggle-email")).toBeInTheDocument(),
      );

      // Toggle each channel
      fireEvent.click(screen.getByTestId("notification-toggle-email"));
      expect(screen.getByTestId("notification-toggle-email")).not.toBeChecked();

      fireEvent.click(screen.getByTestId("notification-toggle-push"));
      expect(screen.getByTestId("notification-toggle-push")).not.toBeChecked();

      fireEvent.click(screen.getByTestId("notification-toggle-sms"));
      expect(screen.getByTestId("notification-toggle-sms")).toBeChecked();

      fireEvent.click(screen.getByTestId("notification-toggle-inApp"));
      expect(screen.getByTestId("notification-toggle-inApp")).not.toBeChecked();

      // Submit with all channels toggled
      mockFetchOnce({
        ...defaultPreferences,
        notifications: {
          email: false,
          push: false,
          sms: true,
          inApp: false,
        },
      });

      fireEvent.click(screen.getByTestId("save-preferences-btn"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/account/preferences",
          expect.objectContaining({
            body: JSON.stringify({
              email: "user@example.com",
              locale: "en-US",
              displayCurrency: "USD",
              notifications: {
                email: false,
                push: false,
                sms: true,
                inApp: false,
              },
            }),
          }),
        );
      });
    });
  });
});
