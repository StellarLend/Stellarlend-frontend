import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import TrustlinePrompt from "./trustline-prompt";
import messages from "@/messages/en.json";

const ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function renderPrompt(props: Partial<React.ComponentProps<typeof TrustlinePrompt>> = {}) {
  const onAdd = props.onAdd ?? vi.fn();
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TrustlinePrompt symbol="USDC" spendableXlm={10} onAdd={onAdd} {...props} />
    </NextIntlClientProvider>
  );
}

describe("TrustlinePrompt", () => {
  it("shows the reserve shortfall instead of the button when spendable XLM is below the reserve", () => {
    renderPrompt({ spendableXlm: 0.1 });
    expect(screen.getByTestId("trustline-reserve-shortfall")).toHaveTextContent(
      messages.market.trustlineInsufficientReserve.replace("{reserve}", "0.5").replace("{symbol}", "USDC")
    );
    expect(screen.queryByRole("button", { name: "Add trustline" })).not.toBeInTheDocument();
  });

  it("renders the add button and calls onAdd when the account can cover the reserve", () => {
    const onAdd = vi.fn();
    renderPrompt({ spendableXlm: 5, onAdd });
    fireEvent.click(screen.getByRole("button", { name: "Add trustline" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows a localized message for a user rejection", () => {
    renderPrompt({ error: "rejected" });
    expect(screen.getByTestId("trustline-error")).toHaveTextContent(messages.market.trustlineRejected);
  });

  it("shows a localized message for an op_low_reserve failure", () => {
    renderPrompt({ error: "lowReserve" });
    expect(screen.getByTestId("trustline-error")).toHaveTextContent(messages.market.trustlineLowReserve);
  });

  it("links to the issuer account in the explorer", () => {
    renderPrompt({ issuer: ISSUER });
    expect(screen.getByRole("link", { name: messages.market.viewIssuer })).toHaveAttribute(
      "href",
      expect.stringContaining(`/account/${ISSUER}`)
    );
  });
});
