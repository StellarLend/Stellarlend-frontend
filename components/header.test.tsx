import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { Header } from "./header";

vi.mock("@/components/wallet", () => ({
  ConnectButton: () => <button data-testid="connect-btn">Connect</button>,
  useWallet: () => ({ address: null, connected: false }),
}));

describe("Header", () => {
  it("en links have no prefix", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Header />
      </NextIntlClientProvider>,
    );

    const homeLink = screen.getByRole("link", { name: new RegExp(en.nav.brand) });
    expect(homeLink.getAttribute("href")).toBe("/");

    const marketsLink = screen.getByRole("link", { name: en.nav.markets });
    expect(marketsLink.getAttribute("href")).toBe("/markets");

    const historyLink = screen.getByRole("link", { name: en.nav.history });
    expect(historyLink.getAttribute("href")).toBe("/history");

    const flashLoansLink = screen.getByRole("link", { name: en.nav.flashLoans });
    expect(flashLoansLink.getAttribute("href")).toBe("/flash-loans");

    const ammLink = screen.getByRole("link", { name: en.nav.amm });
    expect(ammLink.getAttribute("href")).toBe("/amm");

    const governanceLink = screen.getByRole("link", { name: en.nav.governance });
    expect(governanceLink.getAttribute("href")).toBe("/governance");

    const docsLink = screen.getByRole("link", { name: en.nav.docs });
    expect(docsLink.getAttribute("href")).toBe("/docs");

    const githubLink = screen.getByRole("link", { name: en.nav.github });
    expect(githubLink.getAttribute("href")).toBe("https://github.com/StellarLend/Stellarlend-frontend");
  });

  it("es links have /es prefix", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <Header />
      </NextIntlClientProvider>,
    );

    const homeLink = screen.getByRole("link", { name: new RegExp(es.nav.brand) });
    expect(homeLink.getAttribute("href")).toBe("/es");

    const marketsLink = screen.getByRole("link", { name: es.nav.markets });
    expect(marketsLink.getAttribute("href")).toBe("/es/markets");

    const historyLink = screen.getByRole("link", { name: es.nav.history });
    expect(historyLink.getAttribute("href")).toBe("/es/history");

    const flashLoansLink = screen.getByRole("link", { name: es.nav.flashLoans });
    expect(flashLoansLink.getAttribute("href")).toBe("/es/flash-loans");

    const ammLink = screen.getByRole("link", { name: es.nav.amm });
    expect(ammLink.getAttribute("href")).toBe("/es/amm");

    const governanceLink = screen.getByRole("link", { name: es.nav.governance });
    expect(governanceLink.getAttribute("href")).toBe("/es/governance");

    const docsLink = screen.getByRole("link", { name: es.nav.docs });
    expect(docsLink.getAttribute("href")).toBe("/es/docs");

    const githubLink = screen.getByRole("link", { name: es.nav.github });
    expect(githubLink.getAttribute("href")).toBe("https://github.com/StellarLend/Stellarlend-frontend");
  });

  it("renders banner area and switcher without wallet provider crash", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Header />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    expect(screen.getByTestId("connect-btn")).toBeTruthy();
  });
});
