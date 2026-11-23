import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { LocaleSwitcher, localizedHref } from "./locale-switcher";

const mockUsePathname = vi.fn<() => string>();
const mockUseSearchParams = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

describe("localizedHref", () => {
  it("adds es prefix and keeps query", () => {
    expect(localizedHref("/markets", "asset=USDC", "", "es")).toBe("/es/markets?asset=USDC");
  });

  it("removes es prefix", () => {
    expect(localizedHref("/es/markets", "asset=USDC", "", "en")).toBe("/markets?asset=USDC");
  });

  it("root path maps to /es", () => {
    expect(localizedHref("/", "", "", "es")).toBe("/es");
    expect(localizedHref("/es", "", "", "en")).toBe("/");
  });

  it("keeps hash", () => {
    expect(localizedHref("/markets", "asset=USDC", "#risk", "es")).toBe(
      "/es/markets?asset=USDC#risk",
    );
    expect(localizedHref("/es/markets", "asset=USDC", "#risk", "en")).toBe(
      "/markets?asset=USDC#risk",
    );
  });

  it("does not double-encode raw search strings", () => {
    expect(localizedHref("/markets", "asset=USD%20C&tab=1", "", "es")).toBe(
      "/es/markets?asset=USD%20C&tab=1",
    );
  });
});

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUseSearchParams.mockReset();
    window.history.replaceState(null, "", "/");
  });

  it("renders localized href with query string", () => {
    mockUsePathname.mockReturnValue("/markets");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("asset=USDC"));

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: en.nav.switchLocale });
    expect(link.getAttribute("href")).toBe("/es/markets?asset=USDC");
  });

  it("appends window.location.hash after mount", async () => {
    mockUsePathname.mockReturnValue("/es/markets");
    mockUseSearchParams.mockReturnValue(new URLSearchParams("asset=USDC"));
    window.history.replaceState(null, "", "/es/markets?asset=USDC#risk");

    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: es.nav.switchLocale });
    await waitFor(() => {
      expect(link.getAttribute("href")).toBe("/markets?asset=USDC#risk");
    });
  });
});
