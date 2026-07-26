import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DataExportButton from "./DataExportButton";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch
global.fetch = vi.fn();

describe("DataExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders button with correct text", () => {
    render(<DataExportButton />);
    expect(screen.getByRole("button", { name: /export my data/i })).toBeInTheDocument();
  });

  it("shows processing state when clicked", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        downloadUrl: "https://example.com/export.zip",
        expiresInSeconds: 900,
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparing/i })).toBeInTheDocument();
    });
  });

  it("prevents concurrent clicks while exporting", async () => {
    let resolveFetch: (value: any) => void;
    (global.fetch as any).mockImplementation(() => 
      new Promise(resolve => { resolveFetch = resolve; })
    );

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });

    fireEvent.click(button);
    fireEvent.click(button); // Second click should be ignored

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparing/i })).toBeInTheDocument();
    });

    // Resolve the fetch
    resolveFetch!({
      ok: true,
      json: async () => ({
        success: true,
        downloadUrl: "https://example.com/export.zip",
        expiresInSeconds: 900,
      }),
    });
  });

  it("shows success toast and triggers download on successful export", async () => {
    const mockCreateElement = vi.spyOn(document, "createElement");
    const mockAppendChild = vi.spyOn(document.body, "appendChild");
    const mockRemove = vi.spyOn(Element.prototype, "remove");

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        downloadUrl: "https://example.com/export.zip",
        expiresInSeconds: 900,
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export ready")).toBeInTheDocument();
      expect(screen.getByText("Your data export has been downloaded successfully.")).toBeInTheDocument();
    });

    expect(mockCreateElement).toHaveBeenCalledWith("a");
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();

    mockCreateElement.mockRestore();
    mockAppendChild.mockRestore();
    mockRemove.mockRestore();
  });

  it("shows error toast on rate limit (429)", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: "DSAR export rate limit exceeded. Please wait 23 hour(s) before requesting again.",
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("shows error toast on server error (500)", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "Internal Server Error",
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export failed")).toBeInTheDocument();
    });
  });

  it("shows error toast on network failure", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export failed")).toBeInTheDocument();
      expect(screen.getByText("Network error occurred. Please check your connection and try again.")).toBeInTheDocument();
    });
  });

  it("offers a retry affordance after a failed export", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "Internal Server Error",
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export failed")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  it("shows error toast when downloadUrl is missing", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        downloadUrl: null,
        expiresInSeconds: 900,
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Export incomplete")).toBeInTheDocument();
      expect(screen.getByText("No download URL received. Please try again.")).toBeInTheDocument();
    });
  });

  it("has accessible busy state announced to screen readers", async () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-describedby", "export-status");
    });

    expect(screen.getByText("Your data export is being prepared. Please wait.")).toBeInTheDocument();
  });

  it("removes busy state after completion", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        downloadUrl: "https://example.com/export.zip",
        expiresInSeconds: 900,
      }),
    });

    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).not.toHaveAttribute("aria-busy");
      expect(button).not.toHaveAttribute("aria-describedby");
    });
  });

  it("applies custom className", () => {
    render(<DataExportButton className="custom-class" />);
    const button = screen.getByRole("button", { name: /export my data/i });
    expect(button).toHaveClass("custom-class");
  });
});
