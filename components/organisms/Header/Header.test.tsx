import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";

const walletContext = vi.hoisted(() => ({
  address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  status: "connected",
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/context/WalletContext", () => ({
  useWalletContext: () => walletContext,
}));

vi.mock("@/components/features/notifications/NotificationCenter", () => ({
  default: () => null,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

describe("Header", () => {
  it("renders and toggles the connected-wallet dropdown", () => {
    render(<Header />);

    const walletButton = screen.getByRole("button", {
      name: "Connected wallet",
    });

    expect(
      screen.queryByRole("button", { name: "Disconnect Wallet" }),
    ).not.toBeInTheDocument();

    fireEvent.click(walletButton);
    expect(
      screen.getByRole("button", { name: "Disconnect Wallet" }),
    ).toBeInTheDocument();

    fireEvent.click(walletButton);
    expect(
      screen.queryByRole("button", { name: "Disconnect Wallet" }),
    ).not.toBeInTheDocument();
  });
});
