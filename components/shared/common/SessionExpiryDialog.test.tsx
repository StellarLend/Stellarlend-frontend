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

    await user.tab();
    expect(stayLoggedInButton).toHaveFocus();
  });
});
