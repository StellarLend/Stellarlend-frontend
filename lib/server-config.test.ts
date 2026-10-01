import { describe, expect, it } from "vitest";

import { parseHorizonUrls } from "@/lib/server-config";

describe("parseHorizonUrls", () => {
  it("parses comma-separated URLs that contain extra whitespace", () => {
    const raw = "  https://horizon-a.stellar.org ,\t  https://horizon-b.stellar.org/  ,,  ";

    expect(parseHorizonUrls(raw)).toEqual([
      "https://horizon-a.stellar.org",
      "https://horizon-b.stellar.org",
    ]);
  });

  it("trims stray whitespace and strips trailing slashes from each entry", () => {
    expect(parseHorizonUrls("   https://horizon.stellar.org///   ")).toEqual([
      "https://horizon.stellar.org",
    ]);
  });

  it("deduplicates entries that normalize to the same URL", () => {
    expect(
      parseHorizonUrls("https://horizon.stellar.org, https://horizon.stellar.org/"),
    ).toEqual(["https://horizon.stellar.org"]);
  });

  it("keeps distinct URLs in their original order", () => {
    expect(
      parseHorizonUrls("https://b.stellar.org, https://a.stellar.org"),
    ).toEqual(["https://b.stellar.org", "https://a.stellar.org"]);
  });

  it("falls back to the testnet Horizon URL when the value is empty or blank", () => {
    const fallback = ["https://horizon-testnet.stellar.org"];

    expect(parseHorizonUrls(undefined)).toEqual(fallback);
    expect(parseHorizonUrls("")).toEqual(fallback);
    expect(parseHorizonUrls("   ,  , ")).toEqual(fallback);
  });
});
