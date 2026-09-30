import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/shared/common/Toast";
import { TransactionExportButton } from "./TransactionExportButton";

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:test-export");
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  Object.defineProperty(global, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURLMock,
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

function renderExportButton(filters: Record<string, string | undefined> = {}) {
  return render(
    <ToastProvider>
      <TransactionExportButton filters={filters as any} />
    </ToastProvider>,
  );
}

describe("TransactionExportButton", () => {
  it("serializes active filters into the export request and downloads the CSV", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Disposition": 'attachment; filename="transactions.csv"' }),
      blob: vi.fn().mockResolvedValue(new Blob(["id,type\n1,test"], { type: "text/csv" })),
    });

    renderExportButton({
      asset: "XLM",
      type: "lend",
      status: "Completed",
      search: "hello",
      dateFrom: "2025-01-01",
      dateTo: "2025-02-01",
    });

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("asset=XLM");
    expect(url).toContain("type=lend");
    expect(url).toContain("status=Completed");
    expect(url).toContain("search=hello");
    expect(url).toContain("fromDate=2025-01-01");
    expect(url).toContain("toDate=2025-02-01");
    expect(options).toEqual({ method: "GET" });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("still downloads an empty CSV export when the response body is empty", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      blob: vi.fn().mockResolvedValue(new Blob([], { type: "text/csv" })),
    });

    renderExportButton({});

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    });

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:test-export");
  });

  it("shows an error toast when the export request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    renderExportButton({});

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(screen.getByText("Export failed")).toBeInTheDocument();
    });
  });
});
