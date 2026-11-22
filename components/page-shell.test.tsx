// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { PageShell } from "./page-shell";

vi.mock("next-intl/server", () => ({
  getMessages: vi.fn(async ({ locale }: { locale?: string } = {}) => (locale === "es" ? es : en)),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/wallet", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConnectButton: () => <button type="button">{"connect"}</button>,
}));

vi.mock("@/components/protocol-status", () => ({
  ProtocolStatusBanner: () => null,
}));

vi.mock("@/components/network-banner", () => ({
  NetworkBanner: () => null,
}));

vi.mock("@/components/footer", () => ({
  Footer: () => <footer />,
}));

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

describe("PageShell skip-to-content link", () => {
  it("renders the skip link as the first focusable element targeting #main", async () => {
    const element = await PageShell({ locale: "en", children: <div>{"content"}</div> });
    const { container } = render(element);

    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    expect(focusables.length).toBeGreaterThan(0);

    const firstFocusable = focusables[0];
    expect(firstFocusable.tagName).toBe("A");
    expect(firstFocusable.getAttribute("href")).toBe("#main");
    expect(firstFocusable.textContent).toBe(en.nav.skipToContent);
    expect(firstFocusable.className).toContain("sr-only");
    expect(firstFocusable.className).toContain("focus:not-sr-only");
    expect(firstFocusable.className).toContain("var(--acc)");

    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    expect(main?.getAttribute("tabindex")).toBe("-1");
  });

  it("renders the localized skip link for es locale", async () => {
    const element = await PageShell({ locale: "es", children: <div>{"content"}</div> });
    const { container } = render(element);

    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    expect(firstFocusable?.getAttribute("href")).toBe("#main");
    expect(firstFocusable?.textContent).toBe(es.nav.skipToContent);
  });
});
