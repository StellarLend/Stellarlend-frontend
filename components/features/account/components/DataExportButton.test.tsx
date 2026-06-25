import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import DataExportButton from "./DataExportButton";

const successPayload = {
  success: true,
  message: "Export compilation complete.",
  downloadUrl:
    "https://storage.stellarlend.com/exports/user_test_9921/dsar.zip?X-Amz-Expires=900",
  expiresInSeconds: 900,
};

function mockFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("DataExportButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests a DSAR export and downloads the signed bundle", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 202,
      json: async () => successPayload,
    });
    const download = vi.fn();

    render(<DataExportButton onDownload={download} />);

    fireEvent.click(screen.getByRole("button", { name: /export my data/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/account/export", {
        method: "POST",
      });
      expect(download).toHaveBeenCalledWith(successPayload.downloadUrl);
    });

    expect(screen.getByText(/data export ready/i)).toBeInTheDocument();
  });

  it("announces busy state and prevents duplicate concurrent requests", async () => {
    let resolveResponse: (value: Partial<Response>) => void = () => {};
    const pendingResponse = new Promise<Partial<Response>>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);

    render(<DataExportButton onDownload={vi.fn()} />);

    const button = screen.getByRole("button", { name: /export my data/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent(/exporting data/i);

    resolveResponse({
      ok: true,
      status: 202,
      json: async () => successPayload,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export my data/i })).not.toBeDisabled();
    });
  });

  it("shows an error toast when the export request fails", async () => {
    mockFetch({
      ok: false,
      status: 429,
      json: async () => ({
        error: "DSAR export rate limit exceeded. Please wait 24 hour(s) before requesting again.",
      }),
    });
    const download = vi.fn();

    render(<DataExportButton onDownload={download} />);

    fireEvent.click(screen.getByRole("button", { name: /export my data/i }));

    expect(await screen.findByText(/export failed/i)).toBeInTheDocument();
    expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
  });
});
