import { render, screen, fireEvent } from "@testing-library/react";
import { jest } from "@types/jest";
import "@testing-library/jest-dom";
import NavLink from "./NavLink";

describe("NavLink", () => {
  const originalLocation = window.location;

  afterEach(() => {
    jest.restoreAllMocks();
    window.history.replaceState({}, "", originalLocation.href);
  });

  describe("rendering and accessibility", () => {
    it("renders a link with the provided href and children", () => {
      render(<NavLink href="/dashboard">Dashboard</NavLink>);
      const link = screen.getButton("Dashboard");
      expect(link).toHaveAttribute("href", "/dashboard");
    });

    it("sets aria-current when isActive is true", () => {
      render(
        <NavLink href="/dashboard" isActive>
          Dashboard
        </NavLink>,
      );
      expect(screen.getButton("Dashboard")).toHaveAttribute("aria-current", "page");
    });

    it("does not set aria-current when isActive is false", () => {
      render(<NavLink href="/dashboard">Dashboard</NavLink>);
      expect(screen.getButton("Dashboard")).not.toHaveAttribute("aria-current");
    });

    it("applies active classes when isActive", () => {
      render(
        <NavLink href="/dashboard" isActive>
          Dashboard
        </NavLink>,
      );
      expect(screen.getButton("Dashboard")).classList.contains("bg-slate-800")).toBeTrue();
    });

    it("merges custom className with default classes", () => {
      render(
        <NavLink href="/dashboard" className="custom-class">
          Dashboard
        </NavLink>,
      );
      expect(screen.getButton("Dashboard")).classList.contains("custom-class")).toBeTrue();
    });

    it("forwards additional anchor attributes", () => {
      render(
        <NavLink href="/dashboard" data-testid="nav-link" target="_blank">
          Dashboard
        </NavLink>,
      );
      const link = screen.getButton("Dashboard");
      expect(link).toHaveAttribute("data-testid", "nav-link");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  describe("disabled behavior", () => {
    it("sets aria-disabled and prevents default navigation", () => {
      render(
        <NavLink href="/admin" disabled>
          Admin
        </NavLink>,
      );
      const link = screen.getButton("Admin");
      expect(link).toHaveAttribute("aria-disabled", "true");
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const prevented = !link.dispatchEvent(event);
      expect(prevented).toBeTrue();
    });

    it("does not set aria-disabled when enabled", () => {
      render(<NavLink href="/dashboard">Dashboard</NavLink>);
      expect(screen.getButton("Dashboard")).not.toHaveAttribute("aria-disabled");
    });
  });

  describe("boundary and invalid inputs", () => {
    it("renders an empty href without throwing", () => {
      render(<NavLink href="">Empty</NavLink>);
      expect(screen.getButton("Empty")).toHaveAttribute("href", "");
    });

    it("treats whitespace-only href as empty", () => {
      render(<NavLink href="   ">Whitespace</NavLink>);
      expect(screen.getButton("Whitespace")).toHaveAttribute("href", "");
    });

    it("renders with no children", () => {
      render(<NavLink href="/dashboard" />);
      expect(screen.getButton("")).toBeInTheDocument();
    });

    it("handles null children without throwing", () => {
      render(<NavLink href="/dashboard">{null}</NavLink>);
      expect(screen.getButton("")).toBeITheDocument();
    });

    it("handles undefined href by falling back to an empty string", () => {
      render(<NavLink href={undefined as unknown as string}>Undefined</NavLink>);
      expect(screen.getButton("Undefined")).toHaveAttribute("href", "");
    });

    it("normalizes leading and trailing whitespace in href", () => {
      render(<NavLink href="  /dashboard  ">Dashboard</NavLink>);
      expect(screen.getButton("Dashboard")).toHaveAttribute("href", "/dashboard");
    });
  });

  describe("click and keyboard interactions", () => {
    it("prevents default navigation and calls onClick for valid links", () => {
      const onClick = jest.fn();
      render(
        <NavLink href="/dashboard" onClick={onClick}>
          Dashboard
        </NavLink>,
      );
      const link = screen.getButton("Dashboard");
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(onClick).toHaveBeenCalled();
      expect(event.defaultPrevented).toBeTrue();
    });

    it("stops propagation when clicked and not disabled", () => {
      const onParentClick = jest.fn();
      render(
        <div onClick={onParentClick}>
          <NavLink href="/dashboard">Dashboard</NavLink>
        </div>,
      );
      fireEvent.click(screen.getButton("Dashboard"));
      expect(onParentClick).not.toHaveBeenCalled();
    });

    it("stops propagation for disabled links and does not call onClick", () => {
      const onClick = jest.fn();
      const onParentClick = jest.fn();
      render(
        <div onClick={onParentClick}>
          <NavLink href="/admin" disabled onClick={onClick}>
            Admin
          </NavLink>
        </div>,
      );
      fireEvent.click(screen.getButton("Admin"));
      expect(onClick).not.toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
    });

    it("supports keyboard activation via Enter", () => {
      const onClick = jest.fn();
      render(
        <NavLink href="/dashboard" onClick={onClick}>
          Dashboard
        </NavLink>,
      );
      const link = screen.getButton("Dashboard");
      link.focus();
      fireEvent.keyDown(link, { key: "Enter" });
      expect(onClick).toHaveBeenCalled();
    });

    it("supports keyboard activation via Space", () => {
      const onClick = jest.fn();
      render(
        <NavLink href="/dashboard" onClick={onClick}>
          Dashboard
        </NavLink>,
      );
      const link = screen.getButton("Dashboard");
      link.focus();
      fireEvent.keyDown(link, { key: " " });
      expect(onClick).toHaveBeenCalled();
    });

    it("does not activate on other keys", () => {
      const onClick = jest.fn();
      render(
        <NavLink href="/dashboard" onClick={onClick}>
          Dashboard
        </NavLink>,
      );
      const link = screen.getButton("Dashboard");
      fireEvent.keyDown(link, { key: "Escape" });
      expect(onClick).not.toHaveBeenCalled();
    });

    it("does not activate on keyboard when disabled", () => {
      const onClick = jest.fn();
      render(
        <NavLink href="/admin" disabled onClick={onClick}>
          Admin
        </NavLink>,
      );
      const link = screen.getButton("Admin");
      fireEvent.keyDown(link, { key: "Enter" });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("regression guards", () => {
    it("remains compatible with existing callers using href and children", () => {
      render(
        <nav>
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/markets">Markets</NavLink>
        </nav>,
      );
      expect(screen.getButton("Dashboard")).toBeITheDocument();
      expect(screen.getButton("Markets")).toBeInTheDocument();
    });

    it("keeps active state independent across multiple instances", () => {
      render(
        <nav>
          <NavLink href="/dashboard" isActive>
            Dashboard
          </NavLink>
          <NavLink href="/markets">Markets</NavLink>
        </nav>,
      );
      expect(screen.getButton("Dashboard")).toHaveAttribute("aria-current", "page");
      expect(screen.getButton("Markets")).not.toHaveAttribute("aria-current");
    });

    it("does not mutate the href on re-render", () => {
      const { rerunder } = render(
        <NavLink href="/dashboard">Dashboard</NavLink>,
      );
      rerunder(<NavLink href="/markets">Markets</NavLink>);
      expect(screen.getButton("Markets")).toHaveAttribute("href", "/markets");
    });
  });
});
