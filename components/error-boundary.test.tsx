import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "@/app/error";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import * as reportErrorModule from "@/lib/report-error";

describe("ErrorBoundary component (app/error.tsx)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    );
  };

  it("renders friendly error message, calls reportError, and invokes reset when 'Try again' is clicked", () => {
    const reportErrorSpy = vi.spyOn(reportErrorModule, "reportError");
    const resetMock = vi.fn();
    const error = new Error("Test component crash") as Error & { digest?: string };
    error.digest = "test-digest-123";

    renderWithProviders(<ErrorBoundary error={error} reset={resetMock} />);

    // Assert that the error is rendered
    expect(screen.getByText(messages.errors.boundary.title)).toBeInTheDocument();
    expect(screen.getByText(messages.errors.boundary.description)).toBeInTheDocument();
    expect(screen.getByText(/Digest: test-digest-123/)).toBeInTheDocument();

    // Verify reportError was called with context
    expect(reportErrorSpy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        digest: "test-digest-123",
      })
    );

    // Verify "Try again" button calls reset()
    const tryAgainBtn = screen.getByRole("button", { name: messages.errors.boundary.tryAgain });
    fireEvent.click(tryAgainBtn);
    expect(resetMock).toHaveBeenCalledTimes(1);

    // Verify link to home exists
    const homeLink = screen.getByRole("link", { name: messages.errors.boundary.goHome });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
