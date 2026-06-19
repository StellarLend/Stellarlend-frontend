import { render } from "@testing-library/react";
import Toast from "./Toast";
import { describe, it, expect } from "vitest";

describe("Toast", () => {
  it("renders title and description", () => {
    const { getByText } = render(
      <Toast title="Hi" description="there" variant="success" />,
    );
    expect(getByText("Hi")).toBeTruthy();
    expect(getByText("there")).toBeTruthy();
  });
});
