import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  walletState: {
    networkMismatch: false,
    network: null as string | null,
    expectedPassphrase: "",
  },
}));

vi.mock("./wallet", () => ({
  useWallet: () => mocks.walletState,
}));

import { NetworkBanner } from "./network-banner";

function renderBanner(locale: "en" | "es" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? es : en}>
      <NetworkBanner />
    </NextIntlClientProvider>,
  );
}

describe("NetworkBanner", () => {
  beforeEach(() => {
    mocks.walletState = {
      networkMismatch: false,
      network: null,
      expectedPassphrase: "",
    };
  });

  it("renders nothing when the wallet network matches", () => {
    renderBanner();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the current and expected network labels in the alert", () => {
    mocks.walletState = {
      networkMismatch: true,
      network: "public",
      expectedPassphrase: "Test SDF Network ; September 2015",
    };

    renderBanner();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Freighter is connected to a different network (PUBLIC). Please switch Freighter to Testnet to interact and sign transactions.",
    );
    expect(alert).toHaveTextContent(
      "Signing is blocked until you switch Freighter to Testnet.",
    );
  });

  it("renders translated network labels in Spanish when the current network is unknown", () => {
    mocks.walletState = {
      networkMismatch: true,
      network: null,
      expectedPassphrase: "Public Global Stellar Network ; September 2015",
    };

    renderBanner("es");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Desconocida");
    expect(alert).toHaveTextContent("Red pública");
    expect(alert).not.toHaveTextContent("Unknown");
    expect(alert).not.toHaveTextContent("Public");
  });

  it("renders the translated Testnet label in Spanish", () => {
    mocks.walletState = {
      networkMismatch: true,
      network: "public",
      expectedPassphrase: "Test SDF Network ; September 2015",
    };

    renderBanner("es");

    expect(screen.getByRole("alert")).toHaveTextContent("Red de pruebas");
  });
});
