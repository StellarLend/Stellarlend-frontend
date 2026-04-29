import { render, screen, fireEvent } from "@/test/test-utils";
import { Pagination } from "./Pagination";
import { describe, it, expect, vi } from "vitest";

describe("Pagination Component", () => {
  const defaultProps = {
    totalItems: 18,
    itemsPerPage: 6,
    currentPage: 1,
    setCurrentPage: vi.fn(),
  };

  it("renders correctly with given props", () => {
    render(<Pagination {...defaultProps} />);
    
    expect(screen.getByText("Showing")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("of")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<Pagination {...defaultProps} />);
    
    const prevButton = screen.getByLabelText("Previous page");
    expect(prevButton).toBeDisabled();
  });

  it("enables next button if there are more pages", () => {
    render(<Pagination {...defaultProps} />);
    
    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton).not.toBeDisabled();
  });

  it("calls setCurrentPage when next button is clicked", () => {
    render(<Pagination {...defaultProps} />);
    
    const nextButton = screen.getByLabelText("Next page");
    fireEvent.click(nextButton);
    
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(2);
  });

  it("calls setCurrentPage when a page number is clicked", () => {
    render(<Pagination {...defaultProps} />);
    
    const page2Button = screen.getByText("2");
    fireEvent.click(page2Button);
    
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(2);
  });

  it("disables next button on last page", () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    
    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton).toBeDisabled();
  });
});
