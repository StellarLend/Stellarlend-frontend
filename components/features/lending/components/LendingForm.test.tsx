import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import type { ComponentProps } from "react";
import LendingForm from "./LendingForm";
import { afterEach, describe, expect, it, vi } from "vitest";

const initialData = {
  asset: "XLM",
  amount: 0,
  interestRate: 8.5,
};

function renderLendingForm(
  onSubmit = vi.fn(),
  props: Partial<ComponentProps<typeof LendingForm>> = {},
) {
  render(
    <LendingForm
      initialData={initialData}
      onSubmit={onSubmit}
      submitDelayMs={0}
      {...props}
    />,
  );
  return onSubmit;
}

function amountInput() {
  return screen.getByLabelText(/amount to lend/i);
}

function rateSlider() {
  return screen.getByRole("slider", { name: /interest rate/i });
}

function enterAmount(amount: string) {
  fireEvent.change(amountInput(), { target: { value: amount } });
}

function submitValidOffer(onSubmit = vi.fn()) {
  renderLendingForm(onSubmit);
  enterAmount("100");
  fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

  return onSubmit;
}

describe("LendingForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the core lending controls with accessible names", () => {
    renderLendingForm();

    expect(screen.getByRole("heading", { name: /lend your assets/i })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: /select asset/i })).toBeInTheDocument();
    expect(amountInput()).toBeInTheDocument();
    expect(rateSlider()).toHaveAttribute("min", "5");
    expect(rateSlider()).toHaveAttribute("max", "12");
    expect(screen.getByRole("button", { name: /review lending offer/i })).toBeInTheDocument();
  });

  it.each([
    ["empty amount", ""],
    ["zero amount", "0"],
    ["negative amount", "-50"],
  ])("rejects %s", async (_caseName, value) => {
    const onSubmit = renderLendingForm();

    enterAmount(value);
    fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

    expect(screen.getByText(/please enter a valid amount/i)).toBeInTheDocument();
    expect(screen.getByText(/please fix the errors in the form/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an amount above the selected asset balance", async () => {
    const onSubmit = renderLendingForm();

    enterAmount("10000");
    fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

    expect(screen.getByText(/insufficient balance/i)).toHaveTextContent(
      "Maximum available: 3,750 XLM",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["below the minimum", "4.9"],
    ["above the maximum", "12.1"],
  ])("rejects an interest rate %s", async (_caseName, rate) => {
    const onSubmit = renderLendingForm(vi.fn(), {
      initialData: { ...initialData, interestRate: Number(rate) },
    });

    enterAmount("100");
    fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

    expect(screen.getByText(/interest rate must be between 5% and 12%/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["minimum", "5"],
    ["maximum", "12"],
  ])("accepts the %s interest rate boundary", async (_caseName, rate) => {
    const onSubmit = renderLendingForm();

    enterAmount("100");
    fireEvent.change(rateSlider(), { target: { value: rate } });
    fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, asset: "XLM", interestRate: Number(rate) }),
      );
    });
  });

  it("fills the selected asset balance from the MAX action and clears amount errors", async () => {
    renderLendingForm();

    fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));
    expect(screen.getByText(/please enter a valid amount/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^max$/i }));

    expect(amountInput()).toHaveValue("3,750.0000000");
    expect(screen.queryByText(/please enter a valid amount/i)).not.toBeInTheDocument();
  });

  it("updates the default rate when the selected asset changes", async () => {
    renderLendingForm();

    expect(screen.getByText("8.5% APY")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /usdc/i }));

    expect(screen.getByRole("option", { name: /usdc/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("6.5% APY")).toBeInTheDocument();
    expect(rateSlider()).toHaveAttribute("min", "4");
    expect(rateSlider()).toHaveAttribute("max", "10");
  });

  it("disables the submit button while validation is pending", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    submitValidOffer(onSubmit);

    const submitButton = screen.getByRole("button", { name: /review lending offer/i });
    expect(submitButton).toBeDisabled();

    resolveSubmit();

    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it("submits valid data and shows the success state", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    submitValidOffer(onSubmit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, asset: "XLM", interestRate: 8.5 }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Details validated successfully.");
    });
  });

  it("shows the error state when submit handling fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network unavailable"));

    submitValidOffer(onSubmit);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An error occurred during validation.",
      );
    });
  });

  it("documents the visible terms and rate markers", () => {
    renderLendingForm();

    expect(screen.getByText("Lending Terms")).toBeInTheDocument();
    expect(screen.getByText(/minimum lending period: 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/interest is calculated daily and compounded/i)).toBeInTheDocument();
    expect(screen.getByText("MIN: 5%")).toBeInTheDocument();
    expect(screen.getByText("DEFAULT: 8.5%")).toBeInTheDocument();
    expect(screen.getByText("MAX: 12%")).toBeInTheDocument();
  });
});
