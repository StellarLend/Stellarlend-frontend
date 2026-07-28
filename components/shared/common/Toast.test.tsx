import React from "react";
import { act, render, screen } from "@testing-library/react";
import Toast, { ToastProvider, useToast, type ToastMessage } from "./Toast";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders title and description", () => {
    const { getByText } = render(
      <Toast title="Hi" description="there" variant="success" />,
    );
    expect(getByText("Hi")).toBeTruthy();
    expect(getByText("there")).toBeTruthy();
  });

  it("shows and expires provider toasts", () => {
    vi.useFakeTimers();
    let toastApi: {
      showToast: (toast: ToastMessage) => string;
      dismissToast: (id: string) => void;
    } | null = null;

    function CaptureToastApi() {
      toastApi = useToast();
      return null;
    }

    render(
      <ToastProvider defaultDurationMs={1000}>
        <CaptureToastApi />
      </ToastProvider>,
    );

    act(() => {
      toastApi?.showToast({
        title: "Saved",
        description: "Preferences updated.",
      });
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("replaces a toast with the same id and resets its timer", () => {
    vi.useFakeTimers();
    let toastApi: {
      showToast: (toast: ToastMessage) => string;
      dismissToast: (id: string) => void;
    } | null = null;

    function CaptureToastApi() {
      toastApi = useToast();
      return null;
    }

    render(
      <ToastProvider defaultDurationMs={1000}>
        <CaptureToastApi />
      </ToastProvider>,
    );

    act(() => {
      toastApi?.showToast({ id: "same", title: "First" });
      toastApi?.showToast({ id: "same", title: "Second" });
    });

    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("throws when useToast is rendered outside ToastProvider", () => {
    function MissingProvider() {
      useToast();
      return null;
    }

    expect(() => render(<MissingProvider />)).toThrow(
      "useToast must be used within ToastProvider",
    );
  });
});
