import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RootLayout, {
  metadata,
  isValidCspNonce,
  serializeCspNonceScript,
  resolveSafeNonce,
  CSP_NONCE_REGEX,
} from "./layout";
import { headers } from "next/headers";
import { logger } from "@/lib/logger";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock CSS import
vi.mock("./globals.css", () => ({}));

// Mock sub-providers to keep unit test focused on layout chrome and invariants
vi.mock("@/context/SidebarContext", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-sidebar-provider">{children}</div>
  ),
}));

vi.mock("@/context/WalletContext", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-wallet-provider">{children}</div>
  ),
}));

vi.mock("@/components/shared/common/Toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-toast-provider">{children}</div>
  ),
}));

vi.mock("@/components/shared/common/NotificationToastBridge", () => ({
  default: () => <div data-testid="mock-notification-toast-bridge" />,
}));

vi.mock("nextjs-toploader", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="mock-top-loader" data-props={JSON.stringify(props)} />
  ),
}));

describe("app/layout.tsx - RootLayout & Invariants", () => {
  const validNonce = "dGVzdG5vbmNlMTIzNDU2Nw=="; // 24-char base64 standard nonce

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Public Metadata & Signature Compatibility", () => {
    it("preserves default metadata with title and description", () => {
      expect(metadata).toBeDefined();
      expect(metadata.title).toBe("StellarLend");
      expect(metadata.description).toBe(
        "Decentralized lending and borrowing on Stellar"
      );
    });

    it("exports CSP_NONCE_REGEX covering standard base64 and base64url nonces", () => {
      expect(CSP_NONCE_REGEX).toBeInstanceOf(RegExp);
    });
  });

  describe("isValidCspNonce - boundary & input validation", () => {
    it("accepts valid standard base64 nonces (16 to 128 characters)", () => {
      expect(isValidCspNonce(validNonce)).toBe(true);
      expect(isValidCspNonce("1234567890abcdef")).toBe(true); // 16 chars (min boundary)
      expect(isValidCspNonce("A".repeat(128))).toBe(true); // 128 chars (max boundary)
      expect(isValidCspNonce("aBcDeFgHiJkLmNoP+qRsTuVwXyZ0123456789/=")).toBe(true);
      expect(isValidCspNonce("aBcDeFgHiJkLmNoP-qRsTuVwXyZ0123456789_")).toBe(true); // base64url
    });

    it("rejects non-string types", () => {
      expect(isValidCspNonce(null)).toBe(false);
      expect(isValidCspNonce(undefined)).toBe(false);
      expect(isValidCspNonce(1234567890123456)).toBe(false);
      expect(isValidCspNonce({})).toBe(false);
      expect(isValidCspNonce(["dGVzdG5vbmNlMTIzNDU2Nw=="])).toBe(false);
      expect(isValidCspNonce(true)).toBe(false);
    });

    it("rejects empty and whitespace strings", () => {
      expect(isValidCspNonce("")).toBe(false);
      expect(isValidCspNonce(" ")).toBe(false);
      expect(isValidCspNonce("   \t\n  ")).toBe(false);
    });

    it("rejects strings with leading or trailing whitespace", () => {
      expect(isValidCspNonce(` ${validNonce}`)).toBe(false);
      expect(isValidCspNonce(`${validNonce} `)).toBe(false);
      expect(isValidCspNonce(`\n${validNonce}\n`)).toBe(false);
    });

    it("rejects nonces below the minimum length boundary (< 16 chars)", () => {
      expect(isValidCspNonce("abc")).toBe(false);
      expect(isValidCspNonce("123456789012345")).toBe(false); // 15 chars
    });

    it("rejects nonces exceeding the maximum length boundary (> 128 chars)", () => {
      expect(isValidCspNonce("A".repeat(129))).toBe(false);
    });

    it("rejects hostile strings with script tags or HTML breakout characters", () => {
      expect(isValidCspNonce("</script><script>alert(1)</script>")).toBe(false);
      expect(isValidCspNonce("<script>alert(1)</script>")).toBe(false);
      expect(isValidCspNonce("nonce1<invalid>")).toBe(false);
    });

    it("rejects hostile strings with JavaScript string breakout characters", () => {
      expect(isValidCspNonce('"; alert(1); //')).toBe(false);
      expect(isValidCspNonce("'; alert(1); //")).toBe(false);
      expect(isValidCspNonce("`+alert(1)+`")).toBe(false);
      expect(isValidCspNonce("nonce\\escape")).toBe(false);
    });

    it("rejects duplicate/comma-separated headers (e.g. from reverse proxy concatenation)", () => {
      expect(
        isValidCspNonce("dGVzdG5vbmNlMTIzNDU2Nw==, dGVzdG5vbmNlMTIzNDU2Nw==")
      ).toBe(false);
    });

    it("rejects control characters, newlines, and null bytes", () => {
      expect(isValidCspNonce("dGVzdG5vbmNlMTI\0zNDU2Nw==")).toBe(false);
      expect(isValidCspNonce("dGVzdG5vbmNlMTI\nzNDU2Nw==")).toBe(false);
      expect(isValidCspNonce("dGVzdG5vbmNlMTI\rzNDU2Nw==")).toBe(false);
    });
  });

  describe("serializeCspNonceScript - escaping invariants", () => {
    it("serializes a valid nonce into a safe window.CSP_NONCE assignment", () => {
      const result = serializeCspNonceScript("dGVzdG5vbmNlMTIzNDU2Nw==");
      expect(result).toBe('window.CSP_NONCE = "dGVzdG5vbmNlMTIzNDU2Nw==";');
    });

    it("escapes '<' characters to '\\u003c' to prevent script-tag termination breakouts", () => {
      const result = serializeCspNonceScript("</script>");
      expect(result).not.toContain("</script>");
      expect(result).toContain("\\u003c/script>");
    });
  });

  describe("resolveSafeNonce - header retrieval & fault tolerance", () => {
    it("resolves valid nonce when header is present and valid", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-csp-nonce": validNonce }) as unknown as Awaited<
          ReturnType<typeof headers>
        >
      );

      const nonce = await resolveSafeNonce();
      expect(nonce).toBe(validNonce);
    });

    it("returns undefined when x-csp-nonce header is omitted", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers() as unknown as Awaited<ReturnType<typeof headers>>
      );

      const nonce = await resolveSafeNonce();
      expect(nonce).toBeUndefined();
    });

    it("returns undefined and logs diagnostic warning when x-csp-nonce is invalid", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers({
          "x-csp-nonce": '"; alert(1); //',
        }) as unknown as Awaited<ReturnType<typeof headers>>
      );

      const nonce = await resolveSafeNonce();
      expect(nonce).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        "Rejected malformed or invalid x-csp-nonce header",
        "RootLayout",
        expect.objectContaining({
          reason: "regex_mismatch_or_invalid_length",
          nonceLength: 15,
        })
      );
    });

    it("gracefully catches headers() throw (e.g. static generation or broken context) without crashing", async () => {
      vi.mocked(headers).mockRejectedValue(
        new Error("Dynamic server usage: headers() could not be resolved")
      );

      const nonce = await resolveSafeNonce();
      expect(nonce).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to retrieve request headers in RootLayout; degrading gracefully",
        "RootLayout",
        expect.objectContaining({
          error: "Dynamic server usage: headers() could not be resolved",
        })
      );
    });

    it("handles headers() returning null or object without .get gracefully", async () => {
      vi.mocked(headers).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof headers>>
      );

      const nonce = await resolveSafeNonce();
      expect(nonce).toBeUndefined();
    });

    it("does not crash if logger.warn throws internally", async () => {
      vi.mocked(logger.warn).mockImplementation(() => {
        throw new Error("Logger write error");
      });
      vi.mocked(headers).mockRejectedValue(new Error("Headers unavailable"));

      // Should not rethrow logger error
      await expect(resolveSafeNonce()).resolves.toBeUndefined();
    });
  });

  describe("RootLayout Component - rendering & structure", () => {
    it("renders complete document layout with nonce script when valid nonce is present", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers({ "x-csp-nonce": validNonce }) as unknown as Awaited<
          ReturnType<typeof headers>
        >
      );

      const result = await RootLayout({
        children: <div data-testid="test-content">App Body</div>,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe("html");
      expect(result.props.lang).toBe("en");
      expect(result.props.suppressHydrationWarning).toBe(true);

      const children = React.Children.toArray(result.props.children);
      const head = children.find(
        (child) => React.isValidElement(child) && child.type === "head"
      ) as React.ReactElement;
      const body = children.find(
        (child) => React.isValidElement(child) && child.type === "body"
      ) as React.ReactElement;

      expect(head).toBeDefined();
      expect(body).toBeDefined();
      expect(body.props.className).toBe("antialiased");

      // Verify meta referrer tag
      const meta = React.Children.toArray(head.props.children).find(
        (child) => React.isValidElement(child) && child.type === "meta"
      ) as React.ReactElement;
      expect(meta.props.name).toBe("referrer");
      expect(meta.props.content).toBe("strict-origin-when-cross-origin");

      // Verify body children: NextTopLoader, script (with nonce), and ToastProvider
      const bodyChildren = React.Children.toArray(body.props.children);

      const scriptElement = bodyChildren.find(
        (child) => React.isValidElement(child) && child.type === "script"
      ) as React.ReactElement;
      expect(scriptElement).toBeDefined();
      expect(scriptElement.props.nonce).toBe(validNonce);
      expect(scriptElement.props.referrerPolicy).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(scriptElement.props.dangerouslySetInnerHTML.__html).toBe(
        `window.CSP_NONCE = "${validNonce}";`
      );
    });

    it("renders cleanly without inline script when nonce is absent", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers() as unknown as Awaited<ReturnType<typeof headers>>
      );

      const result = await RootLayout({
        children: <span>Child Content</span>,
      });

      const body = React.Children.toArray(result.props.children).find(
        (child) => React.isValidElement(child) && child.type === "body"
      ) as React.ReactElement;

      const bodyChildren = React.Children.toArray(body.props.children);
      const scriptElement = bodyChildren.find(
        (child) => React.isValidElement(child) && child.type === "script"
      );
      expect(scriptElement).toBeUndefined();
    });

    it("omits inline script and does not crash when headers() throws", async () => {
      vi.mocked(headers).mockRejectedValue(new Error("SSR header failure"));

      const result = await RootLayout({
        children: <div>Safe Recovery Content</div>,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe("html");

      const body = React.Children.toArray(result.props.children).find(
        (child) => React.isValidElement(child) && child.type === "body"
      ) as React.ReactElement;
      const scriptElement = React.Children.toArray(body.props.children).find(
        (child) => React.isValidElement(child) && child.type === "script"
      );
      expect(scriptElement).toBeUndefined();
    });

    it("handles boundary children inputs: null, undefined, boolean, number, fragment", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers() as unknown as Awaited<ReturnType<typeof headers>>
      );

      // null children
      const nullLayout = await RootLayout({ children: null });
      expect(nullLayout).toBeDefined();

      // undefined children
      const undefinedLayout = await RootLayout({ children: undefined });
      expect(undefinedLayout).toBeDefined();

      // boolean children (React renders nothing for false/true)
      const falseLayout = await RootLayout({
        children: false as unknown as React.ReactNode,
      });
      expect(falseLayout).toBeDefined();

      // number children
      const numberLayout = await RootLayout({ children: 0 });
      expect(numberLayout).toBeDefined();

      // fragment children
      const fragmentLayout = await RootLayout({
        children: (
          <React.Fragment>
            <div>Item 1</div>
            <div>Item 2</div>
          </React.Fragment>
        ),
      });
      expect(fragmentLayout).toBeDefined();
    });

    it("preserves provider nesting order: ToastProvider > NotificationToastBridge > WalletProvider > SidebarProvider > children", async () => {
      vi.mocked(headers).mockResolvedValue(
        new Headers() as unknown as Awaited<ReturnType<typeof headers>>
      );

      const result = await RootLayout({
        children: <div id="deep-child">Leaf Node</div>,
      });

      const body = React.Children.toArray(result.props.children).find(
        (child) => React.isValidElement(child) && child.type === "body"
      ) as React.ReactElement;

      // ToastProvider is present in body
      const bodyChildren = React.Children.toArray(body.props.children);
      const toastProvider = bodyChildren.find(
        (child) =>
          React.isValidElement(child) &&
          typeof child.type === "function" &&
          (child.type as React.ComponentType).name === "ToastProvider"
      ) as React.ReactElement;
      expect(toastProvider).toBeDefined();
    });
  });

  describe("Concurrency & Timing Boundary", () => {
    it("handles concurrent RootLayout executions with different nonces without state leakage", async () => {
      const nonces = [
        "bm9uY2UxMTExMTExMTExMQ==",
        "bm9uY2UyMjIyMjIyMjIyMg==",
        "invalid;injection!payload",
        "bm9uY2UzMzMzMzMzMzMzMw==",
      ];

      // Simulate 4 concurrent requests arriving at different microtask timings
      const results = await Promise.all(
        nonces.map(async (n, index) => {
          vi.mocked(headers).mockImplementationOnce(async () => {
            // Add jitter delay to simulate asynchronous I/O
            await new Promise((resolve) => setTimeout(resolve, 5 * (index % 2)));
            return new Headers({ "x-csp-nonce": n }) as unknown as Awaited<
              ReturnType<typeof headers>
            >;
          });

          return RootLayout({
            children: <div id={`req-${index}`}>Content {index}</div>,
          });
        })
      );

      expect(results).toHaveLength(4);

      // Verify request 0 had nonce 0
      const body0 = React.Children.toArray(results[0].props.children).find(
        (c) => React.isValidElement(c) && c.type === "body"
      ) as React.ReactElement;
      const script0 = React.Children.toArray(body0.props.children).find(
        (c) => React.isValidElement(c) && c.type === "script"
      ) as React.ReactElement;
      expect(script0.props.nonce).toBe(nonces[0]);

      // Verify request 2 (invalid injection) was rejected without script
      const body2 = React.Children.toArray(results[2].props.children).find(
        (c) => React.isValidElement(c) && c.type === "body"
      ) as React.ReactElement;
      const script2 = React.Children.toArray(body2.props.children).find(
        (c) => React.isValidElement(c) && c.type === "script"
      );
      expect(script2).toBeUndefined();
    });
  });
});
