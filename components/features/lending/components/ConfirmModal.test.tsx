import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmModal from "./ConfirmModal";
import type { LendingData, CalculationResult } from "@/app/lending/page";
import type { LendingActionType } from "@/lib/lending/types";

// Mock the top-level page types since ConfirmModal imports them
jest.mock("@/app/lending/page", () => ({}));
jest.mock("@/lib/lending/types", () => ({}));

const mockData: LendingData = {
  amount: 1000,
  asset: "USDC",
  interestRate: 5.5,
  duration: 30,
};

const mockCalculation: CalculationResult = {
  dailyEarnings: 0.15,
  totalEarnings: 4.58,
  monthlyPayment: undefined,
  totalRepayment: undefined,
};

const renderModal = (
  isOpen = true,
  type: LendingActionType = "lend",
  calculation: CalculationResult | null = mockCalculation,
) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn().mockResolvedValue(undefined);

  const result = render(
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      data={mockData}
      calculation={calculation}
      type={type}
    />,
  );

  return { onClose, onConfirm, ...result };
};

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe("ConfirmModal", () => {
  describe("rendering", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = renderModal(false);
      expect(container.innerHTML).toBe("");
    });

    it("renders modal content when isOpen is true", () => {
      renderModal(true);
      expect(screen.getByText("Confirm Lending Transaction")).toBeInTheDocument();
      expect(screen.getByText(/1,000\.00 USDC/)).toBeInTheDocument();
      expect(screen.getByLabelText("Close modal")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Confirm Lend")).toBeInTheDocument();
    });

    it("renders borrow variant correctly", () => {
      renderModal(true, "borrow");
      expect(screen.getByText("Confirm Borrowing Transaction")).toBeInTheDocument();
    });

    it("renders repay variant correctly", () => {
      renderModal(true, "repay");
      expect(screen.getByText("Confirm Repayment Transaction")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // FOCUS MANAGEMENT TESTS
  // ============================================================================

  describe("focus management", () => {
    it("focuses the close button when modal opens", () => {
      renderModal(true, "lend", null);
      // The close button should receive focus after opening
      const closeButton = screen.getByLabelText("Close modal");
      expect(closeButton).toBe(document.activeElement);
    });

    it("restores focus to the previously focused element when modal closes", () => {
      const outerButton = document.createElement("button");
      outerButton.textContent = "Open Modal";
      document.body.appendChild(outerButton);
      outerButton.focus();
      expect(outerButton).toBe(document.activeElement);

      const { rerender, onClose } = renderModal(true, "lend", null);
      
      // Close the modal
      act(() => {
        onClose();
      });

      // Re-render with isOpen=false
      rerender(
        <ConfirmModal
          isOpen={false}
          onClose={onClose}
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          data={mockData}
          calculation={null}
          type="lend"
        />,
      );

      // Focus should be restored
      expect(outerButton).toBe(document.activeElement);
      document.body.removeChild(outerButton);
    });
  });

  // ============================================================================
  // ESCAPE-TO-CLOSE TESTS
  // ============================================================================

  describe("escape-to-close", () => {
    it("calls onClose when Escape key is pressed while modal is open", () => {
      const { onClose } = renderModal(true);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does NOT call onClose when Escape is pressed but modal is closed", () => {
      const { onClose } = renderModal(false);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not close on other keys", () => {
      const { onClose } = renderModal(true);
      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Tab" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FOCUS TRAP TESTS
  // ============================================================================

  describe("focus trap", () => {
    it("cycles focus to the first focusable element when Tab is pressed on last element", () => {
      renderModal(true, "lend", null);
      const focusableElements = screen.getAllByRole("button");
      const firstButton = focusableElements[0];
      const lastButton = focusableElements[focusableElements.length - 1];

      // Focus the last button
      lastButton.focus();
      expect(lastButton).toBe(document.activeElement);

      // Press Tab — should cycle to first
      fireEvent.keyDown(document, { key: "Tab" });
      expect(firstButton).toBe(document.activeElement);
    });

    it("cycles focus to the last element when Shift+Tab is pressed on first element", () => {
      renderModal(true, "lend", null);
      const focusableElements = screen.getAllByRole("button");
      const firstButton = focusableElements[0];
      const lastButton = focusableElements[focusableElements.length - 1];

      // Focus the first button
      firstButton.focus();
      expect(firstButton).toBe(document.activeElement);

      // Press Shift+Tab — should cycle to last
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(lastButton).toBe(document.activeElement);
    });
  });

  // ============================================================================
  // CONFIRM INTERACTION TESTS
  // ============================================================================

  describe("confirmation flow", () => {
    it("disables confirm button until terms are agreed", () => {
      renderModal(true, "lend", null);
      const confirmButton = screen.getByText("Confirm Lend");
      expect(confirmButton).toBeDisabled();

      // Agree to terms
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(confirmButton).toBeEnabled();
    });

    it("calls onConfirm when agreed and confirmed", async () => {
      const { onConfirm } = renderModal(true, "lend", null);

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const confirmButton = screen.getByText("Confirm Lend");
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("shows success message and calls onClose after confirm", async () => {
      const { onClose } = renderModal(true, "lend", null);

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const confirmButton = screen.getByText("Confirm Lend");
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("Transaction confirmed successfully!")).toBeInTheDocument();
      
      // Wait for the timeout to fire
      jest.useFakeTimers();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(onClose).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it("shows error message when confirm fails", async () => {
      const onConfirm = jest.fn().mockRejectedValue(new Error("Failed"));
      render(
        <ConfirmModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          data={mockData}
          calculation={null}
          type="lend"
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const confirmButton = screen.getByText("Confirm Lend");
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(screen.getByText("Transaction failed. Please try again.")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CLOSE INTERACTION TESTS
  // ============================================================================

  describe("close interactions", () => {
    it("calls onClose when close button is clicked", () => {
      const { onClose } = renderModal(true);
      fireEvent.click(screen.getByLabelText("Close modal"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Cancel button is clicked", () => {
      const { onClose } = renderModal(true);
      fireEvent.click(screen.getByText("Cancel"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
