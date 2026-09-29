import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ArrowLeftRightLine,
  Bank,
  CoinIcon,
  DashboardFill,
  Dollar,
  Dropdown,
  FastSecure,
  File,
  Global,
  LoginCircleFill,
  Notification,
  Notification2Fill,
  ReceiptFill,
  Settings5Fill,
  ShieldBlockchain,
  TransactionIcon,
  Union,
  WalletFill,
  Zap,
} from "./index";

const iconComponents = [
  ArrowLeftRightLine,
  Bank,
  CoinIcon,
  DashboardFill,
  Dollar,
  Dropdown,
  FastSecure,
  File,
  Global,
  LoginCircleFill,
  Notification,
  Notification2Fill,
  ReceiptFill,
  Settings5Fill,
  ShieldBlockchain,
  TransactionIcon,
  Union,
  WalletFill,
  Zap,
];

describe("shared SVG icons", () => {
  it.each(iconComponents)(
    "defaults decorative icons to aria-hidden",
    (Icon) => {
      const { container } = render(<Icon />);

      expect(container.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    },
  );

  it.each(iconComponents)(
    "uses an accessible name when rendered with a title",
    (Icon) => {
      render(
        <button type="button">
          <Icon title="Open notifications" />
        </button>,
      );

      expect(
        screen.getByRole("button", { name: "Open notifications" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "Open notifications" }),
      ).toBeInTheDocument();
    },
  );
});
