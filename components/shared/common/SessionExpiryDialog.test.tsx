import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SessionExpiryDialog from "./SessionExpiryDialog";

function renderDialog(onLogOut = vi.fn()) {
  render(
    <SessionExpiryDialog
      isOpen
      onStayLoggedIn={vi.fn()}
      onLogOut={onLogOut}
    />
  );
}

describe("SessionExpiryDialog", () => {
  it("focuses Stay Logged In when opened", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "Stay Logged In" })
    ).toHaveFocus();
  });

  it("calls onLogOut when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    renderDialog(onLogOut);

    await user.keyboard("{Escape}");

    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("cycles focus between Log Out and Stay Logged In with Tab", async () => {
    const user = userEvent.setup();
    renderDialog();

    const logOutButton = screen.getByRole("button", { name: "Log Out" });
    const stayLoggedInButton = screen.getByRole("button", {
      name: "Stay Logged In",
    });

    expect(stayLoggedInButton).toHaveFocus();

    await user.tab();
    expect(logOutButton).toHaveFocus();

    // Wraps from the last focusable element back to the first.
    await user.tab();
    expect(stayLoggedInButton).toHaveFocus();
  });

  it("cycles focus backwards between Stay Logged In and Log Out with Shift+Tab", async () => {
    const user = userEvent.setup();
    renderDialog();

    const logOutButton = screen.getByRole("button", { name: "Log Out" });
    const stayLoggedInButton = screen.getByRole("button", {
      name: "Stay Logged In",
    });

    expect(stayLoggedInButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(logOutButton).toHaveFocus();

    // Wraps from the first focusable element back to the last, so focus is
    // never released out of the dialog.
    await user.tab({ shift: true });
    expect(stayLoggedInButton).toHaveFocus();
  });

  it("keeps focus trapped inside the dialog when tabbing repeatedly", async () => {
    const user = userEvent.setup();
    renderDialog();

    const logOutButton = screen.getByRole("button", { name: "Log Out" });
    const stayLoggedInButton = screen.getByRole("button", {
      name: "Stay Logged In",
    });

    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(
        logOutButton === document.activeElement ||
          stayLoggedInButton === document.activeElement
      ).toBe(true);
    }
  });

  it("calls onLogOut when the Log Out button is clicked", async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    renderDialog(onLogOut);

    await user.click(screen.getByRole("button", { name: "Log Out" }));

    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("calls onStayLoggedIn when the Stay Logged In button is clicked", async () => {
    const user = userEvent.setup();
    const onStayLoggedIn = vi.fn();
    render(
      <SessionExpiryDialog
        isOpen
        onStayLoggedIn={onStayLoggedIn}
        onLogOut={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Stay Logged In" }));

    expect(onStayLoggedIn).toHaveBeenCalledTimes(1);
  });
});
