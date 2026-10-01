import React from "react";
import { render, screen, fireEvent } from "@/test/test-utils";
import { Pagination } from "./Pagination";
import { describe, it, expect, vi } from "vitest";

type PaginationProps = React.ComponentProps<typeof Pagination>;

const makeProps = (overrides: Partial<PaginationProps> = {}): PaginationProps => ({
  totalItems: 18,
  itemsPerPage: 6,
  currentPage: 1,
  setCurrentPage: vi.fn(),
  ...overrides,
});

const getPageButtons = (): HTMLElement[] =>
  screen
    .getAllByRole("button")
    .filter((button) => /^Page \d+$/.test(button.getAttribute("aria-label") ?? ""));

const pageLabels = (): number[] =>
  getPageButtons().map((button) =>
    Number((button.getAttribute("aria-label") ?? "").replace("Page ", "")),
  );

const ellipsisCount = (): number =>
  screen.queryAllByText("...").filter((el) => el.tagName.toLowerCase() === "span")
    .length;

describe("Pagination Component", () => {
  describe("visible range summary", () => {
    it("renders the visible range and total for the first page", () => {
      const { container } = render(<Pagination {...makeProps()} />);
      expect(container.textContent).toContain("Showing 1 to 6 of 18");
    });

    it("caps the range end at totalItems on a partial last page", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: 10, itemsPerPage: 4, currentPage: 3 })} />,
      );
      expect(container.textContent).toContain("Showing 9 to 10 of 10");
    });

    it("renders an exact end when the total is a multiple of the page size", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: 12, itemsPerPage: 4, currentPage: 3 })} />,
      );
      expect(container.textContent).toContain("Showing 9 to 12 of 12");
    });

    it("shows an empty range when there are no items", () => {
      const { container } = render(<Pagination {...makeProps({ totalItems: 0 })} />);
      expect(container.textContent).toContain("Showing 0 to 0 of 0");
    });
  });

  describe("navigation callbacks", () => {
    it("calls setCurrentPage with the next page when Next is clicked", () => {
      const setCurrentPage = vi.fn();
      render(<Pagination {...makeProps({ currentPage: 2, setCurrentPage })} />);

      fireEvent.click(screen.getByLabelText("Next page"));

      expect(setCurrentPage).toHaveBeenCalledWith(3);
    });

    it("calls setCurrentPage with the previous page when Previous is clicked", () => {
      const setCurrentPage = vi.fn();
      render(<Pagination {...makeProps({ currentPage: 2, setCurrentPage })} />);

      fireEvent.click(screen.getByLabelText("Previous page"));

      expect(setCurrentPage).toHaveBeenCalledWith(1);
    });

    it("calls setCurrentPage with the clicked page number", () => {
      const setCurrentPage = vi.fn();
      render(<Pagination {...makeProps({ currentPage: 1, setCurrentPage })} />);

      fireEvent.click(screen.getByLabelText("Page 3"));

      expect(setCurrentPage).toHaveBeenCalledWith(3);
    });

    it("does not navigate when the disabled Previous button is clicked", () => {
      const setCurrentPage = vi.fn();
      render(<Pagination {...makeProps({ currentPage: 1, setCurrentPage })} />);

      fireEvent.click(screen.getByLabelText("Previous page"));

      expect(setCurrentPage).not.toHaveBeenCalled();
    });
  });

  describe("disabled states", () => {
    it("disables Previous on the first page", () => {
      render(<Pagination {...makeProps({ currentPage: 1 })} />);
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
    });

    it("disables Next on the last page", () => {
      render(<Pagination {...makeProps({ totalItems: 18, itemsPerPage: 6, currentPage: 3 })} />);
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });

    it("disables both controls when the list is empty", () => {
      render(<Pagination {...makeProps({ totalItems: 0 })} />);
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });

    it("disables both controls when a single page holds every item", () => {
      render(<Pagination {...makeProps({ totalItems: 5, itemsPerPage: 10, currentPage: 1 })} />);
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });
  });

  describe("page window and ellipsis truncation", () => {
    it("renders every page (no ellipsis) when there are at most 7 pages", () => {
      render(<Pagination {...makeProps({ totalItems: 70, itemsPerPage: 10, currentPage: 4 })} />);

      expect(pageLabels()).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(ellipsisCount()).toBe(0);
    });

    it("truncates the tail when the active page is near the start", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 1 })} />);

      expect(pageLabels()).toEqual([1, 2, 3, 4, 5, 10]);
      expect(ellipsisCount()).toBe(1);
    });

    it("keeps the left window at the currentPage <= 4 boundary", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 4 })} />);

      expect(pageLabels()).toEqual([1, 2, 3, 4, 5, 10]);
      expect(ellipsisCount()).toBe(1);
    });

    it("truncates both sides when the active page is in the middle", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 5 })} />);

      expect(pageLabels()).toEqual([1, 4, 5, 6, 10]);
      expect(ellipsisCount()).toBe(2);
    });

    it("truncates the head when the active page is near the end", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 10 })} />);

      expect(pageLabels()).toEqual([1, 6, 7, 8, 9, 10]);
      expect(ellipsisCount()).toBe(1);
    });

    it("keeps the right window at the totalPages - 3 boundary", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 7 })} />);

      expect(pageLabels()).toEqual([1, 6, 7, 8, 9, 10]);
      expect(ellipsisCount()).toBe(1);
    });

    it("bounds the number of rendered controls regardless of totalPages", () => {
      render(<Pagination {...makeProps({ totalItems: 100000, itemsPerPage: 1, currentPage: 50 })} />);

      const totalControls = getPageButtons().length + ellipsisCount();
      expect(totalControls).toBeLessThanOrEqual(7);
    });

    it("marks exactly the active page with aria-current", () => {
      render(<Pagination {...makeProps({ totalItems: 100, itemsPerPage: 10, currentPage: 4 })} />);

      expect(screen.getByLabelText("Page 4")).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Page 1")).not.toHaveAttribute("aria-current");
    });
  });

  describe("invalid and boundary inputs", () => {
    it("treats a non-positive itemsPerPage as no pages instead of rendering Infinity/NaN", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: 10, itemsPerPage: 0, currentPage: 1 })} />,
      );

      expect(pageLabels()).toEqual([]);
      expect(container.textContent).not.toContain("Infinity");
      expect(container.textContent).not.toContain("NaN");
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });

    it("treats a negative itemsPerPage as no pages", () => {
      render(<Pagination {...makeProps({ totalItems: 10, itemsPerPage: -5, currentPage: 1 })} />);

      expect(pageLabels()).toEqual([]);
      expect(screen.getByLabelText("Next page")).toBeDisabled();
    });

    it("treats a negative totalItems as empty", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: -3, itemsPerPage: 6, currentPage: 1 })} />,
      );

      expect(container.textContent).toContain("Showing 0 to 0 of 0");
      expect(pageLabels()).toEqual([]);
    });

    it("treats a non-finite totalItems as empty", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: Number.NaN, itemsPerPage: 6, currentPage: 1 })} />,
      );

      expect(container.textContent).toContain("Showing 0 to 0 of 0");
      expect(pageLabels()).toEqual([]);
    });

    it("clamps a currentPage beyond the last page and disables Next", () => {
      const { container } = render(
        <Pagination {...makeProps({ totalItems: 18, itemsPerPage: 6, currentPage: 99 })} />,
      );

      expect(pageLabels()).toEqual([1, 2, 3]);
      expect(screen.getByLabelText("Page 3")).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Next page")).toBeDisabled();
      expect(screen.getByLabelText("Previous page")).not.toBeDisabled();
      expect(container.textContent).toContain("Showing 13 to 18 of 18");
    });

    it("clamps a currentPage below 1 to the first page and disables Previous", () => {
      render(<Pagination {...makeProps({ currentPage: 0 })} />);

      expect(screen.getByLabelText("Page 1")).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
    });

    it("clamps a non-finite currentPage to the first page", () => {
      render(<Pagination {...makeProps({ currentPage: Number.NaN })} />);

      expect(screen.getByLabelText("Page 1")).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Previous page")).toBeDisabled();
    });
  });
});
