import React from "react";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import meta, {
  Dashboard,
  WithActions,
  Lending,
  AccountLight,
  TitleOnly,
  LongContentBoundary,
  SpecialCharactersBoundary,
  InvalidToneFallback,
  EmptyDescription,
  SubHeadingWithCustomId,
  MultipleActions,
  InteractiveActionWithFailureAndRetry,
} from "./PageHeader.stories";
import { PageHeader } from "./PageHeader";

describe("PageHeader Stories Suite", () => {
  describe("Storybook Meta Configuration", () => {
    it("has valid meta configuration and argTypes controls", () => {
      expect(meta.title).toBe("Shared/Common/PageHeader");
      expect(meta.component).toBe(PageHeader);
      expect(meta.tags).toContain("autodocs");
      expect(meta.argTypes?.tone?.options).toEqual(["dark", "light"]);
      expect(meta.argTypes?.as?.options).toEqual(["h1", "h2"]);
    });
  });

  describe("Standard Visual Stories", () => {
    it("renders Dashboard story with expected dark tone styling", () => {
      render(<PageHeader {...Dashboard.args!} />);
      const heading = screen.getByRole("heading", {
        level: 1,
        name: "Dashboard",
      });
      const description = screen.getByText(
        "Track lending, borrowing, and collateral health at a glance.",
      );

      expect(heading).toBeInTheDocument();
      expect(heading.className).toContain("text-white");
      expect(description).toBeInTheDocument();
      expect(description.className).toContain("text-white/80");

      const banner = screen.getByRole("banner");
      expect(banner).toHaveAttribute(
        "aria-labelledby",
        "page-header-dashboard",
      );
      expect(banner).toHaveAttribute(
        "aria-describedby",
        "page-header-dashboard-description",
      );
    });

    it("renders WithActions story with action button slot", () => {
      render(<PageHeader {...WithActions.args!} />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Transactions" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("All on-chain activity tied to your account."),
      ).toBeInTheDocument();
      const actionButton = screen.getByRole("button", { name: "Export CSV" });
      expect(actionButton).toBeInTheDocument();
    });

    it("renders Lending story with title and description", () => {
      render(<PageHeader {...Lending.args!} />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Lending & Borrowing" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Earn interest by lending your assets or borrow against your collateral.",
        ),
      ).toBeInTheDocument();
    });

    it("renders AccountLight story with light tone palette", () => {
      render(<PageHeader {...AccountLight.args!} />);
      const heading = screen.getByRole("heading", {
        level: 1,
        name: "Profile",
      });
      const description = screen.getByText(
        "Manage personal details, security, and notification preferences.",
      );

      expect(heading).toBeInTheDocument();
      expect(heading.className).toContain("text-slate-900");
      expect(description).toBeInTheDocument();
      expect(description.className).toContain("text-slate-500");
    });

    it("renders TitleOnly story without description paragraph", () => {
      const { container } = render(<PageHeader {...TitleOnly.args!} />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Settings" }),
      ).toBeInTheDocument();
      expect(container.querySelector("p")).toBeNull();
      const banner = screen.getByRole("banner");
      expect(banner).not.toHaveAttribute("aria-describedby");
    });

    it("renders stories wrapped inside their decorators properly", () => {
      if (Dashboard.decorators && Dashboard.decorators.length > 0) {
        const Decorator = Dashboard.decorators[0];
        const { container } = render(
          Decorator(() => <PageHeader {...Dashboard.args!} />, {} as any),
        );
        expect(
          container.querySelector(".bg-\\[\\#15A350\\]"),
        ).toBeInTheDocument();
      }

      if (AccountLight.decorators && AccountLight.decorators.length > 0) {
        const Decorator = AccountLight.decorators[0];
        const { container } = render(
          Decorator(() => <PageHeader {...AccountLight.args!} />, {} as any),
        );
        expect(container.querySelector(".bg-slate-50")).toBeInTheDocument();
      }
    });
  });

  describe("Boundary & Adverse Input Stories", () => {
    it("renders LongContentBoundary story gracefully without losing hierarchy", () => {
      render(<PageHeader {...LongContentBoundary.args!} />);
      const heading = screen.getByRole("heading", {
        level: 1,
        name: /Ultra-Long Enterprise Decentralized Asset Collateralization/i,
      });
      expect(heading).toBeInTheDocument();

      const description = screen.getByText(
        /This comprehensive overview provides multi-tenant telemetry/i,
      );
      expect(description).toBeInTheDocument();
    });

    it("renders SpecialCharactersBoundary story safely with sanitization", () => {
      render(<PageHeader {...SpecialCharactersBoundary.args!} />);
      // Verify text is treated as text, not executed as HTML
      const heading = screen.getByRole("heading", {
        level: 1,
        name: '<script>alert("xss")</script> & Collateral $#@! 🎉 "Quotes" / \\',
      });
      expect(heading).toBeInTheDocument();
      expect(document.querySelector("script")).toBeNull();

      // Verify sanitized heading ID
      const headingId = heading.getAttribute("id");
      expect(headingId).toMatch(/^page-header-[a-z0-9_-]+$/);
      expect(headingId).not.toContain("<");
      expect(headingId).not.toContain(">");
      expect(headingId).not.toContain('"');
    });

    it("renders InvalidToneFallback story falling back to dark tone without runtime errors", () => {
      render(<PageHeader {...InvalidToneFallback.args!} />);
      const heading = screen.getByRole("heading", {
        level: 1,
        name: "Invalid Tone Fallback",
      });
      expect(heading.className).toContain("text-white");
    });

    it("renders EmptyDescription story by omitting paragraph and aria-describedby", () => {
      const { container } = render(<PageHeader {...EmptyDescription.args!} />);
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Empty Description Boundary",
        }),
      ).toBeInTheDocument();
      expect(container.querySelector("p")).toBeNull();

      const banner = screen.getByRole("banner");
      expect(banner).not.toHaveAttribute("aria-describedby");
    });

    it("renders SubHeadingWithCustomId story with H2 tag and custom ID", () => {
      render(<PageHeader {...SubHeadingWithCustomId.args!} />);
      const heading = screen.getByRole("heading", {
        level: 2,
        name: "Custom Section",
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveAttribute("id", "custom-section-heading-id");

      const banner = screen.getByRole("banner");
      expect(banner).toHaveAttribute(
        "aria-labelledby",
        "custom-section-heading-id",
      );
      expect(banner).toHaveAttribute(
        "aria-describedby",
        "custom-section-heading-id-description",
      );
    });

    it("renders MultipleActions story with multiple action buttons", () => {
      render(<PageHeader {...MultipleActions.args!} />);
      expect(
        screen.getByRole("button", { name: "Filter Pools" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Add Liquidity" }),
      ).toBeInTheDocument();
    });
  });

  describe("Interactive Failure and Recovery Story", () => {
    it("handles simulated failure on initial attempt and succeeds upon retry", async () => {
      const user = userEvent.setup();
      const RenderComponent =
        InteractiveActionWithFailureAndRetry.render as React.ComponentType;
      render(<RenderComponent />);

      // Initial state
      const syncBtn = screen.getByRole("button", { name: "Sync Reserves" });
      expect(syncBtn).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();

      // Trigger first click -> failure
      await user.click(syncBtn);

      const errorAlert = await screen.findByRole("alert");
      expect(errorAlert).toHaveTextContent("Sync failed. Retry required.");

      const retryBtn = screen.getByRole("button", { name: "Retry Sync" });
      expect(retryBtn).toBeInTheDocument();

      // Trigger retry click -> recovery
      await user.click(retryBtn);

      const successStatus = await screen.findByRole("status");
      expect(successStatus).toHaveTextContent("Reserves synced successfully!");

      const resyncBtn = screen.getByRole("button", { name: "Resync" });
      expect(resyncBtn).toBeInTheDocument();
    });

    it("executes the Storybook play function successfully", async () => {
      const RenderComponent =
        InteractiveActionWithFailureAndRetry.render as React.ComponentType;
      const { container } = render(<RenderComponent />);

      if (InteractiveActionWithFailureAndRetry.play) {
        await InteractiveActionWithFailureAndRetry.play({
          canvasElement: container,
        } as any);

        const successStatus = await screen.findByRole("status");
        expect(successStatus).toHaveTextContent(
          "Reserves synced successfully!",
        );
      }
    });
  });
});
