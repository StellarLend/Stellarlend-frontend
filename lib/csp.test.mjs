/**
 * Tests for lib/csp.ts (pure CSP builder functions)
 *
 * Run with: node --test lib/csp.test.mjs
 * No external dependencies — uses Node 20 built-in test runner.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Inline port of the pure functions from lib/csp.ts ───────────────────────
// (Ported to avoid needing TypeScript compilation in tests)

function extractOrigin(url, dev = false) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`[CSP] Invalid URL: "${trimmed}"`);
  }

  if (!dev && parsed.protocol !== "https:") {
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(`[CSP] Non-HTTPS origin in production config: "${trimmed}"`);
    }
  }

  return parsed.origin;
}

function buildCsp({ nonce, horizon, rpc, dev = false, reportUri }) {
  const horizonOrigin = extractOrigin(horizon, dev);
  const rpcOrigin = extractOrigin(rpc, dev);

  const connectSrcSet = new Set(["'self'"]);
  if (horizonOrigin) connectSrcSet.add(horizonOrigin);
  if (rpcOrigin) connectSrcSet.add(rpcOrigin);
  const connectSrc = [...connectSrcSet].join(" ");

  const scriptSrcParts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (dev) scriptSrcParts.push("'unsafe-eval'");
  const scriptSrc = scriptSrcParts.join(" ");

  const directives = [
    ["default-src", "'self'"],
    ["script-src", scriptSrc],
    ["style-src", "'self' 'unsafe-inline'"],
    ["connect-src", connectSrc],
    ["img-src", "'self' data: blob:"],
    ["font-src", "'self' data:"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["object-src", "'none'"],
    ["worker-src", "'self' blob:"],
  ];

  if (!dev) {
    directives.push(["upgrade-insecure-requests", ""]);
  }

  if (reportUri) {
    directives.push(["report-uri", reportUri]);
  }

  return directives
    .map(([name, value]) => (value ? `${name} ${value}` : name))
    .join("; ");
}

// Helper: parse the CSP string into a { directive -> value } map
function parseCsp(csp) {
  const result = {};
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split(/\s+/);
    result[name] = rest.join(" ");
  }
  return result;
}

const PROD_OPTS = {
  nonce: "abc123",
  horizon: "https://horizon-testnet.stellar.org",
  rpc: "https://soroban-testnet.stellar.org",
  dev: false,
};

const DEV_OPTS = { ...PROD_OPTS, dev: true };

// ── extractOrigin tests ──────────────────────────────────────────────────────
describe("extractOrigin", () => {
  it("returns origin for https URL", () => {
    assert.equal(
      extractOrigin("https://horizon-testnet.stellar.org"),
      "https://horizon-testnet.stellar.org"
    );
  });

  it("strips path from URL", () => {
    assert.equal(
      extractOrigin("https://horizon-testnet.stellar.org/accounts/G123"),
      "https://horizon-testnet.stellar.org"
    );
  });

  it("preserves non-standard port", () => {
    assert.equal(
      extractOrigin("https://localhost:8000/rpc"),
      "https://localhost:8000"
    );
  });

  it("returns null for empty string", () => {
    assert.equal(extractOrigin(""), null);
  });

  it("returns null for whitespace-only string", () => {
    assert.equal(extractOrigin("   "), null);
  });

  it("allows http localhost in production", () => {
    assert.doesNotThrow(() => extractOrigin("http://localhost:3000", false));
  });

  it("allows http 127.0.0.1 in production", () => {
    assert.doesNotThrow(() => extractOrigin("http://127.0.0.1:8080", false));
  });

  it("throws for non-https non-localhost in production", () => {
    assert.throws(
      () => extractOrigin("http://some-external-api.com/rpc", false),
      /Non-HTTPS/
    );
  });

  it("allows http in dev mode", () => {
    assert.doesNotThrow(() => extractOrigin("http://some-internal.api/rpc", true));
  });

  it("throws for malformed URL", () => {
    assert.throws(
      () => extractOrigin("not a url at all%%%"),
      /Invalid URL/
    );
  });
});

// ── buildCsp — production ────────────────────────────────────────────────────
describe("buildCsp (production)", () => {
  it("includes nonce in script-src", () => {
    const csp = buildCsp(PROD_OPTS);
    assert.ok(csp.includes("'nonce-abc123'"), `script-src should contain nonce: ${csp}`);
  });

  it("includes strict-dynamic in script-src", () => {
    const csp = buildCsp(PROD_OPTS);
    const directives = parseCsp(csp);
    assert.ok(directives["script-src"]?.includes("'strict-dynamic'"));
  });

  it("does NOT include unsafe-eval in production", () => {
    const csp = buildCsp(PROD_OPTS);
    assert.ok(!csp.includes("'unsafe-eval'"), "prod CSP must not contain unsafe-eval");
  });

  it("includes upgrade-insecure-requests in production", () => {
    const csp = buildCsp(PROD_OPTS);
    assert.ok(csp.includes("upgrade-insecure-requests"));
  });

  it("connect-src contains self", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.ok(directives["connect-src"]?.includes("'self'"));
  });

  it("connect-src contains Horizon origin", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.ok(
      directives["connect-src"]?.includes("https://horizon-testnet.stellar.org"),
      `connect-src: ${directives["connect-src"]}`
    );
  });

  it("connect-src contains RPC origin", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.ok(
      directives["connect-src"]?.includes("https://soroban-testnet.stellar.org"),
      `connect-src: ${directives["connect-src"]}`
    );
  });

  it("frame-ancestors is 'none'", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.equal(directives["frame-ancestors"], "'none'");
  });

  it("object-src is 'none'", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.equal(directives["object-src"], "'none'");
  });

  it("base-uri is 'self'", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.equal(directives["base-uri"], "'self'");
  });

  it("form-action is 'self'", () => {
    const directives = parseCsp(buildCsp(PROD_OPTS));
    assert.equal(directives["form-action"], "'self'");
  });

  it("two different nonces produce different CSPs", () => {
    const csp1 = buildCsp({ ...PROD_OPTS, nonce: "nonce1" });
    const csp2 = buildCsp({ ...PROD_OPTS, nonce: "nonce2" });
    assert.notEqual(csp1, csp2);
  });
});

// ── buildCsp — development ───────────────────────────────────────────────────
describe("buildCsp (development)", () => {
  it("includes unsafe-eval in dev mode", () => {
    const csp = buildCsp(DEV_OPTS);
    assert.ok(csp.includes("'unsafe-eval'"), "dev CSP must include unsafe-eval for React refresh");
  });

  it("does NOT include upgrade-insecure-requests in dev", () => {
    const csp = buildCsp(DEV_OPTS);
    assert.ok(!csp.includes("upgrade-insecure-requests"));
  });
});

// ── buildCsp — custom origins ────────────────────────────────────────────────
describe("buildCsp — custom RPC origin", () => {
  it("uses provided RPC origin in connect-src", () => {
    const csp = buildCsp({
      ...PROD_OPTS,
      rpc: "https://soroban.example.com:443/rpc",
    });
    const directives = parseCsp(csp);
    assert.ok(
      directives["connect-src"]?.includes("https://soroban.example.com"),
      `connect-src should include custom RPC: ${directives["connect-src"]}`
    );
  });

  it("deduplicates if horizon and rpc are the same origin", () => {
    const csp = buildCsp({
      ...PROD_OPTS,
      horizon: "https://same.example.com/horizon",
      rpc: "https://same.example.com/rpc",
    });
    const directives = parseCsp(csp);
    const origins = directives["connect-src"]?.split(/\s+/) ?? [];
    const count = origins.filter((o) => o === "https://same.example.com").length;
    assert.equal(count, 1, "duplicate origins should be deduplicated");
  });
});

// ── buildCsp — report-uri ────────────────────────────────────────────────────
describe("buildCsp — report-uri", () => {
  it("includes report-uri when provided", () => {
    const csp = buildCsp({
      ...PROD_OPTS,
      reportUri: "https://report.example.com/csp",
    });
    assert.ok(
      csp.includes("report-uri https://report.example.com/csp"),
      `report-uri not found: ${csp}`
    );
  });

  it("omits report-uri when not provided", () => {
    const csp = buildCsp(PROD_OPTS);
    assert.ok(!csp.includes("report-uri"), "report-uri should be absent");
  });
});

// ── extractOrigin — production rejects non-https ─────────────────────────────
describe("buildCsp — rejects non-https origins in production", () => {
  it("throws if horizon is http in production", () => {
    assert.throws(
      () => buildCsp({ ...PROD_OPTS, horizon: "http://external.api.com/horizon", dev: false }),
      /Non-HTTPS/
    );
  });
});
