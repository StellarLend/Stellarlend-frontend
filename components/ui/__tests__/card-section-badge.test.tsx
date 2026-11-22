import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, Card, Section } from "../index";

describe("Card, Section, and Badge primitives", () => {
  describe("Card", () => {
    it("renders card container with children", () => {
      render(<Card className="p-4">{"Card Content"}</Card>);
      expect(screen.getByText("Card Content")).toBeInTheDocument();
      expect(screen.getByText("Card Content")).toHaveClass("card");
    });

    it("renders title, description, and actions slots", () => {
      render(
        <Card
          title="Overview"
          description="Protocol summary"
          actions={<button>Refresh</button>}
        >
          <div>Body</div>
        </Card>
      );
      expect(screen.getByRole("heading", { level: 3, name: "Overview" })).toBeInTheDocument();
      expect(screen.getByText("Protocol summary")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
      expect(screen.getByText("Body")).toBeInTheDocument();
    });
  });

  describe("Section", () => {
    it("renders section element with title and custom contentClassName", () => {
      render(
        <Section title="Getting Started" contentClassName="custom-body">
          <p>{"Step 1"}</p>
        </Section>
      );
      expect(screen.getByRole("heading", { level: 2, name: "Getting Started" })).toBeInTheDocument();
      const bodyWrapper = screen.getByText("Step 1").parentElement;
      expect(bodyWrapper).toHaveClass("custom-body");
    });
  });

  describe("Badge", () => {
    it("renders neutral badge by default", () => {
      render(<Badge>Active</Badge>);
      const badge = screen.getByText("Active");
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain("rounded-full");
    });

    it("applies positive, warning, and danger variants", () => {
      const { rerender } = render(<Badge variant="positive">Verified</Badge>);
      expect(screen.getByText("Verified").className).toContain("text-emerald-400");

      rerender(<Badge variant="warning">Caution</Badge>);
      expect(screen.getByText("Caution").className).toContain("text-amber-400");

      rerender(<Badge variant="danger">Liquidated</Badge>);
      expect(screen.getByText("Liquidated").className).toContain("text-red-400");
    });
  });
});
