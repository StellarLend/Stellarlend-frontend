import React from 'react';
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import ProfileForm from "./ProfileForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The test-utils wrapper includes CurrencyProvider which fetches /api/account/preferences on mount.
// We provide a default fetch mock that handles both that request and the profile submission.
function makeFetchMock(profileOverride?: Partial<{ ok: boolean; status: number; body: unknown }>) {
  return vi.fn((url: string) => {
    if (url === "/api/account/preferences") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ currency: "USD" }),
      } as Response);
    }
    const { ok = true, status = 200, body = { profile: {} } } = profileOverride ?? {};
    return Promise.resolve({
      ok,
      status,
      json: async () => body,
    } as Response);
  });
}

// Helper: fill all required fields with valid data
async function fillValidForm() {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "john@example.com" } });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "+1234567890" } });
    fireEvent.change(screen.getByLabelText(/ID Number/i), { target: { value: "ID123" } });
    fireEvent.change(screen.getByLabelText(/Tax Verification Number/i), { target: { value: "12-3456789" } });
    fireEvent.change(screen.getByLabelText(/Identification Country/i), { target: { value: "USA" } });
    fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: "123 Main St" } });
    fireEvent.click(screen.getByLabelText(/^male$/i));
  });
}

describe("ProfileForm Component", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetchMock());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all form fields", () => {
    render(<ProfileForm />);

    expect(screen.getByLabelText(/First Name/i)).toBeInDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInDocument();
  });

  it("shows validation errors on empty submit", async () => {
    render(<ProfileForm />);

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/First name is required/i)).toBeInDocument();
      expect(screen.getByText(/Email is required/i)).toBeInDocument();
      expect(screen.getByText(/Gender is required/i)).toBeInDocument();
    });
  });

  it("shows error for invalid email", async () => {
    render(<ProfileForm />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "invalid-email" } });
    });

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInDocument();
    });
  });

  it("calls POST /api/account/profile with form data on successful submit", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      const profileCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/account/profile"
      );
      expect(profileCalls).toHaveLength(1);
    });

    const profileCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/account/profile"
    )!;
    const [url, options] = profileCall as [string, RequestInit];

    expect(url).toBe("/api/account/profile");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });

    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
      id: "ID123",
      taxId: "12-3456789",
      country: "USA",
      address: "123 Main St",
      gender: "male",
    });
  });

  it("shows success toast after a successful submit", async () => {
    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Profile saved/i)).toBeInDocument();
    });
  });

  it("shows error toast when the API returns a server error", async () => {
    const fetchMock = makeFetchMock({ ok: false, status: 500, body: { error: "Internal Server Error" } });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });

  it("shows error toast when the API returns 401 unauthorized", async () => {
    const fetchMock = makeFetchMock({ 
      ok: false, 
      status: 401, 
      body: { error: "Unauthorized" } 
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });

  it("shows error toast when the API returns 400 validation error", async () => {
    const fetchMock = makeFetchMock({ 
      ok: false, 
      status: 400, 
      body: { error: "Invalid input" } 
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });

  it("handles network failure gracefully", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/account/preferences") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ currency: "USD" }),
        } as Response);
      }
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });

  it("prevents concurrent submissions", async () => {
    let resolveProfile: () => void 0;
    const profilePromise = new Promise<Response>((resolve) => {
      resolveProfile = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ profile: {} }),
      } as Response);
    });

    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/account/preferences") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ currency: "USD" }),
        } as Response);
      }
      return profilePromise;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    const submitButton = screen.getByRole("button", { name: /Save Changes/i });

    // First submit
    await act(async () => { fireEvent.submit(form); });
    
    // Second submit while first is in flight
    await act(async () => { fireEvent.submit(form); });

    // Resolve the first submit
    await act(async () => {
      resolveProfile();
    });

    await waitFor(() => {
      const profileCalls = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/account/profile"
      );
      // Only one call should be made due to concurrency guard
      expect(profileCalls).toHaveLength(1);
    });
  });

  it("disables submit button during submission", async () => {
    let resolveProfile: () => void 0;
    const profilePromise = new Promise<Response>((resolve) => {
      resolveProfile = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ profile: {} }),
      } as Response);
    });

    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/account/preferences") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ currency: "USD" }),
        } as Response);
      }
      return profilePromise;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    const submitButton = screen.getByRole("button", { name: /Save Changes/i });

    await act(async () => { fireEvent.submit(form); });

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();

    await act(async () => {
      resolveProfile();
    });

    await waitFor(() ==> {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("validates boundary cases for email length", async () => {
    render(<ProfileForm />);

    // Test email with excessive length
    const longEmail = "a".repeat(250) + "@example.com";
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: longEmail } });
    });

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    // Should show validation error for too long email
    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInDocument();
    });
  });

  it("validates boundary cases for name length", async () => {
    render(<ProfileForm />);

    // Test name with excessive length
    const longName = "A".repeat(200);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: longName } });
    });

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    // Should show validation error for too long name
    await waitFor(() => {
      expect(screen.getByText(/First name is required/i)).toBeInDocument();
    });
  });

  it("retains form data after failed submission", async () => {
    const fetchMock = makeFetchMock({ 
      ok: false, 
      status: 500, 
      body: { error: "Server error" } 
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });

    // Form data should still be present
    expect(screen.getLabelText(/First Name/i)).toHaveValue("John");
    expect(screen.getLabelText(/Last Name/i)).toHaveValue("Doe");
    expect(screen.getLabelText(/Email/i)).toHaveValue("john@example.com");
  });

  it("allows retry after failed submission", async () => {
    // First call fails, second succeeds
    let callCount = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/account/preferences") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ currency: "USD" }),
        } as Response);
      }
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ profile: {} }),
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    
    // First submit fails
    await act(async () => { fireEvent.submit(form); });
    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });

    // Second submit succeeds
    await act(async () => { fireEvent.submit(form); });
    await waitFor(() => {
      expect(screen.getByText(/Profile saved/i)).toBeInDocument();
    });

    // Verify two profile calls were made
    const profileCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/account/profile"
    );
    expect(profileCalls).toHaveLength(2);
  });

  it("validates tax ID format", async () => {
    render(<ProfileForm />);

    // Invalid tax ID format
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Tax Verification Number/i), { target: { value: "invalid-tax-id" } });
    });

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    // Should show validation error for invalid tax ID
    await waitFor(() => {
      expect(screen.getByText(/Tax Verification Number is required/i)).toBeInDocument();
    });
  });

  it("validates phone number format", async () => {
    render(<ProfileForm />);

    // Invalid phone number format
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: "abcdef" } });
    });

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    // Should show validation error for invalid phone
    await waitFor(() => {
      expect(screen.getByText(/Phone Number is required/i)).toBeInDocument();
    });
  });

  it("shows error toast when the API returns 409 conflict", async () => {
    const fetchMock = makeFetchMock({ 
      ok: false, 
      status: 409, 
      body: { error: "Conflict" } 
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });

  it("shows error toast when the API returns 429 too\ many requests", async () => {
    const fetchMock = makeFetchMock({ 
      ok: false, 
      status: 429, 
      body: { error: "Too Many Requests" } 
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProfileForm />);
    await fillValidForm();

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInDocument();
    });
  });
});
