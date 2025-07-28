import { render } from "@testing-library/react";
import { ReactElement } from "react";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (ui: ReactElement) =>
  render(ui, { wrapper: AllTheProviders });

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };
