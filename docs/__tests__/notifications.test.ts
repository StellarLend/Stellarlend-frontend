import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const NOTIFICATIONS_DOC = path.join(
  repoRoot,
  "docs",
  "notifications.md",
);

// Pin these to specific text patterns in docs/notifications.md to catch
// accidental edits that would silently break cross-links.
const REQUIRED_SECTIONS = [
  "End-to-End Flow",
  "Components",
  "Unread-Count Syncing",
  "Deduplication",
  "Mark-as-Read",
];

const REQUIRED_BACKEND_REFS = [
  "lib/streams/notification-hub.ts",
  "app/api/notifications/stream/route.ts",
  "hooks/useNotificationStream.ts",
  "lib/notifications/repository.ts",
];

function readDoc(): string {
  if (!existsSync(NOTIFICATIONS_DOC)) {
    throw new Error(`Missing docs/notifications.md at ${NOTIFICATIONS_DOC}`);
  }
  const content = readFileSync(NOTIFICATIONS_DOC, "utf8");
  if (!content || content.trim().length < 200) {
    throw new Error(
      "docs/notifications.md exists but appears to be empty or stub content",
    );
  }
  return content;
}

describe("docs/notifications.md (architecture guide)", () => {
  it("exists and has substantive content", () => {
    const content = readDoc();
    expect(content.length).toBeGreaterThan(800);
  });

  it("contains every required architecture section", () => {
    const content = readDoc();
    for (const heading of REQUIRED_SECTIONS) {
      expect(content).toContain(heading);
    }
  });

  it("references every key backend file the doc describes", () => {
    const content = readDoc();
    for (const ref of REQUIRED_BACKEND_REFS) {
      expect(content).toContain(ref);
    }
  });

  it("cross-links to docs/notifications-ui.md", () => {
    const content = readDoc();
    expect(content).toMatch(/\]\(\.\/notifications-ui\.md\)/);
  });

  it("cross-links to docs/data-fetching.md", () => {
    const content = readDoc();
    expect(content).toMatch(/\]\(\.\/data-fetching\.md\)/);
  });

  it("documents reconnect/backoff numbers (1s → 30s cap)", () => {
    const content = readDoc();
    expect(content).toMatch(/1s\s*[→>-]\s*30s/);
  });

  it("documents dedup behaviour with a bounded seenLimit and a numeric bound", () => {
    const content = readDoc();
    expect(content.toLowerCase()).toContain("dedup");
    const idx = content.indexOf("seenLimit");
    expect(idx).toBeGreaterThanOrEqual(0);
    // The first 250 chars after "seenLimit" must mention a numeric bound so
    // the bounded set isn't described as unbounded.
    const window = content.slice(idx, idx + 250);
    expect(window).toMatch(/\d+/);
  });

  it("API surface table lists /api/notifications, /api/notifications/stream, and /api/notifications/:id", () => {
    const content = readDoc();
    expect(content).toContain("/api/notifications/stream");
    expect(content).toContain("/api/notifications/:id");
    // Catch the table's PATCH line explicitly so silently-dropping the
    // mark-as-read route would fail the test.
    expect(content).toContain("`PATCH`");
    expect(content).toContain("`/api/notifications`");
  });

  it("every referenced backend file actually exists on disk", () => {
    for (const ref of REQUIRED_BACKEND_REFS) {
      const abs = path.join(repoRoot, ref);
      expect(existsSync(abs)).toBe(true);
    }
  });

  it("README.md contains a Developer Guides entry pointing at docs/notifications.md", () => {
    const readmePath = path.join(repoRoot, "README.md");
    if (!existsSync(readmePath)) return;
    const readme = readFileSync(readmePath, "utf8");
    expect(readme).toMatch(
      /\[Notifications architecture[^\]]+\]\(docs\/notifications\.md\)/,
    );
  });

  it("docs/data-fetching.md mentions docs/notifications.md by relative link", () => {
    const docPath = path.join(repoRoot, "docs", "data-fetching.md");
    if (!existsSync(docPath)) return;
    const doc = readFileSync(docPath, "utf8");
    expect(doc).toMatch(/\]\(\.\/notifications\.md\)/);
  });
});
