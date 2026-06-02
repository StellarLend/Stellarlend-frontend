import { render, screen, fireEvent } from "@testing-library/react";
import AssetSelector from "../AssetSelector";
import { ASSETS } from "@/lib/assets";

describe("AssetSelector", () => {
  it("renders all supported assets", () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
  });

  it("calls onChange when asset clicked", () => {
    const onChange = vi.fn();

    render(<AssetSelector assets={ASSETS} value="XLM" onChange={onChange} />);

    fireEvent.click(screen.getByText("BTC"));

    expect(onChange).toHaveBeenCalledWith("BTC");
  });

  it("supports keyboard selection", () => {
    const onChange = vi.fn();

    render(<AssetSelector assets={ASSETS} value="XLM" onChange={onChange} />);

    const btc = screen.getByText("BTC");

    fireEvent.keyDown(btc, {
      key: "Enter",
    });

    expect(onChange).toHaveBeenCalled();
  });

  it("has listbox accessibility role", () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
