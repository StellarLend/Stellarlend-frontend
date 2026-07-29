import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import Account from "./page";

// ── Next.js stubs ────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/account/profile",
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

// ── Feature-component stubs ──────────────────────────────────────────────────
vi.mock("@/components/features/account/components/ProfileForm", () => ({
  default: () => <div data-testid="profile-form" />,
}));

vi.mock("@/components/features/account/components", () => ({
  DataExportButton: () => <div data-testid="data-export-button" />,
  AccountDeletion: () => <div data-testid="account-deletion" />,
}));

// ── Layout / shared stubs ────────────────────────────────────────────────────
vi.mock("@/components/shared/layout/Sidebar", () => ({
  default: () => <nav data-testid="sidebar" />,
}));

vi.mock("@/components/shared/common", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

// ── Tests ────────────────────────────────────────────────────────────────────
describe("Account profile page", () => {
  it("always renders ProfileForm", () => {
    render(<Account />);
    expect(screen.getByTestId("profile-form")).toBeInTheDocument();
  });

  it("always renders DataExportButton", () => {
    render(<Account />);
    expect(screen.getByTestId("data-export-button")).toBeInTheDocument();
  });

  it("always renders AccountDeletion", () => {
    render(<Account />);
    expect(screen.getByTestId("account-deletion")).toBeInTheDocument();
  });

  it("renders all three sub-components in a single pass", () => {
    render(<Account />);
    expect(screen.getByTestId("profile-form")).toBeInTheDocument();
    expect(screen.getByTestId("data-export-button")).toBeInTheDocument();
    expect(screen.getByTestId("account-deletion")).toBeInTheDocument();
  });
});
