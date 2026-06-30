import { render } from "@testing-library/react";
import { ReactElement } from "react";
import { CurrencyProvider } from "@/context/CurrencyContext";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <CurrencyProvider>{children}</CurrencyProvider>;
};

const customRender = (ui: ReactElement) =>
  render(ui, { wrapper: AllTheProviders });

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };
