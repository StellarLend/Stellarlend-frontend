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

    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    render(<ProfileForm />);

    const form = screen.getByRole("button", { name: /Save Changes/i }).closest("form")!;
    await act(async () => { fireEvent.submit(form); });

    await waitFor(() => {
      expect(screen.getByText(/First name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Gender is required/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Profile saved/i)).toBeInTheDocument();
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
      expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
    });
  });
});
