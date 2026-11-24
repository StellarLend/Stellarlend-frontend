import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { Header } from "./header";

vi.mock("@/components/wallet", () => ({
  ConnectButton: () => null,
}));
vi.mock("@/components/locale-switcher", () => ({
  LocaleSwitcher: () => <div />,
}));
vi.mock("@/components/protocol-status", () => ({
  ProtocolStatusBanner: () => null,
}));
vi.mock("@/components/network-banner", () => ({
  NetworkBanner: () => null,
}));

describe("Header", () => {
  it("links Governance to /governance in English and /es/governance in Spanish", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Header />
      </NextIntlClientProvider>,
    );
    const enLink = screen.getByRole("link", { name: en.nav.governance });
    expect(enLink.getAttribute("href")).toBe("/governance");

    rerender(
      <NextIntlClientProvider locale="es" messages={es}>
        <Header />
      </NextIntlClientProvider>,
    );
    const esLink = screen.getByRole("link", { name: es.nav.governance });
    expect(esLink.getAttribute("href")).toBe("/es/governance");
  });
});
