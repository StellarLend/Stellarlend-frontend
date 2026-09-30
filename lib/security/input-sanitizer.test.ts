import { describe, expect, test } from "vitest";
import { sanitiseRecord, sanitiseString } from "./input-sanitizer";
import fc from "fast-check";

const CONTROL_REGEX = /[\u0000-\u001F\u007F-\u009F]/;
const BIDI_REGEX = /[\u202A-\u202E\u2066-\u2069]/;

test("sanitiseString strips control/bidi characters and normalizes NFC", () => {
  fc.assert(
    fc.property(fc.string(), (raw) => {
      const sanitized = sanitiseString(raw);
      expect(CONTROL_REGEX.test(sanitized)).toBe(false);
      expect(BIDI_REGEX.test(sanitized)).toBe(false);
      expect(sanitized).toBe(sanitized.normalize("NFC"));
    }),
  );
});

describe("sanitiseRecord", () => {
  it("sanitises string values and leaves non-strings untouched", () => {
    const input = {
      name: "hello\u0000world",
      age: 30,
      active: true,
      tags: ["a", "b"],
      meta: { key: "val" },
    };
    const result = sanitiseRecord(input);
    expect(result.name).toBe("helloworld");
    expect(result.age).toBe(30);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(["a", "b"]);
    expect(result.meta).toEqual({ key: "val" });
  });

  it("handles a record with only string values", () => {
    const input = { a: "foo\u0000", b: "bar\u200B" };
    const result = sanitiseRecord(input);
    expect(result.a).toBe("foo");
    expect(result.b).toBe("bar");
  });

  it("handles an empty record", () => {
    const result = sanitiseRecord({});
    expect(result).toEqual({});
  });

  it("preserves null and undefined values", () => {
    const input = { a: null, b: undefined, c: "text\u0000" };
    const result = sanitiseRecord(input);
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
    expect(result.c).toBe("text");
  });

  it("strips control characters from nested string values (shallow only)", () => {
    const input = { outer: "ok\u0000", inner: { nested: "bad\u0000" } };
    const result = sanitiseRecord(input);
    expect(result.outer).toBe("ok");
    expect(result.inner).toEqual({ nested: "bad\u0000" });
  });
});
