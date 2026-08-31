import React from "react";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import StatusAnnouncer from "./StatusAnnouncer";

const lendingForms = [
  {
    file: "LendingForm.tsx",
    type: "lend",
  },
  {
    file: "BorrowingForm.tsx",
    type: "borrow",
  },
  {
    file: "RepayForm.tsx",
    type: "repay",
  },
  {
    file: "WithdrawForm.tsx",
    type: "withdraw",
  },
] as const;

describe("StatusAnnouncer", () => {
  it("renders nothing when status is idle", () => {
    const { container } = render(
      <StatusAnnouncer status="idle" type="lend" />,
    );
    expect(container.querySelector('[data-testid="status-announcer"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="status-announcer"]')).toHaveTextContent("");
  });

  it("announces submitting state", () => {
    render(<StatusAnnouncer status="submitting" type="lend" />);
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "Submitting lend request...",
    );
  });

  it("announces success state with default message", () => {
    render(<StatusAnnouncer status="success" type="borrow" />);
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "borrow request completed successfully.",
    );
  });

  it("announces success state with custom message", () => {
    render(
      <StatusAnnouncer
        status="success"
        type="repay"
        message="Repayment successful."
      />,
    );
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "Repayment successful.",
    );
  });

  it("announces error state with default message", () => {
    render(<StatusAnnouncer status="error" type="withdraw" />);
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "An error occurred during withdraw request.",
    );
  });

  it("announces error state with custom message", () => {
    render(
      <StatusAnnouncer
        status="error"
        type="lend"
        message="Something went wrong."
      />,
    );
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "Something went wrong.",
    );
  });
});

describe("StatusAnnouncer contract", () => {
  it.each(lendingForms)(
    "$file renders StatusAnnouncer with type='$type'",
    ({ file, type }) => {
      const source = fs.readFileSync(
        path.join(
          process.cwd(),
          "components",
          "features",
          "lending",
          "components",
          file,
        ),
        "utf8",
      );

      expect(source).toContain("<StatusAnnouncer");
      expect(source).toContain(`type="${type}"`);
    },
  );

  it("documents the lending form StatusAnnouncer contract", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "components",
        "shared",
        "common",
        "StatusAnnouncer.tsx",
      ),
      "utf8",
    );

    expect(source).toContain(
      "Every lending action form (lend / borrow / repay / withdraw) MUST render",
    );
  });
});
