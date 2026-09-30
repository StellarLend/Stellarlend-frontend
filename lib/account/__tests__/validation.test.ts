import { describe, it, expect } from "vitest";
import { validateProfile, profileSchema } from "../validation";

describe("validateProfile", () => {
    describe("Valid payloads", () => {
        it("accepts minimal valid payload (displayName only)", () => {
            const result = validateProfile({ displayName: "Alice" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe("Alice");
                expect(result.data.bio).toBe("");
                expect(result.data.website).toBe("");
                expect(result.data.timezone).toBe("UTC");
            }
        });

        it("accepts all fields provided", () => {
            const input = {
                displayName: "Alice Johnson",
                bio: "DeFi enthusiast",
                website: "https://alice.example.com",
                timezone: "America/New_York",
            };
            const result = validateProfile(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe("Alice Johnson");
                expect(result.data.bio).toBe("DeFi enthusiast");
                expect(result.data.website).toBe("https://alice.example.com");
                expect(result.data.timezone).toBe("America/New_York");
            }
        });

        it("trims whitespace from displayName and bio", () => {
            const result = validateProfile({
                displayName: "  Bob  ",
                bio: "  Hello world  ",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe("Bob");
                expect(result.data.bio).toBe("Hello world");
            }
        });

        it("defaults bio to empty string when omitted", () => {
            const result = validateProfile({ displayName: "Charlie" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bio).toBe("");
            }
        });

        it("defaults website to empty string when omitted", () => {
            const result = validateProfile({ displayName: "Charlie" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.website).toBe("");
            }
        });

        it("defaults timezone to UTC when omitted", () => {
            const result = validateProfile({ displayName: "Charlie" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.timezone).toBe("UTC");
            }
        });

        it("accepts empty bio explicitly", () => {
            const result = validateProfile({ displayName: "Diana", bio: "" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bio).toBe("");
            }
        });

        it("accepts empty website explicitly", () => {
            const result = validateProfile({
                displayName: "Diana",
                website: "",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.website).toBe("");
            }
        });

        it("accepts displayName at max length (80 chars)", () => {
            const name = "A".repeat(80);
            const result = validateProfile({ displayName: name });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe(name);
            }
        });

        it("accepts bio at max length (500 chars)", () => {
            const bio = "B".repeat(500);
            const result = validateProfile({ displayName: "Test", bio });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bio).toBe(bio);
            }
        });

        it("accepts website at max length (200 chars)", () => {
            const path = "a".repeat(188);
            const website = `https://${path}.com`;
            const result = validateProfile({
                displayName: "Test",
                website,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.website).toBe(website);
            }
        });

        it("accepts timezone at max length (60 chars)", () => {
            const tz = "A".repeat(60);
            const result = validateProfile({
                displayName: "Test",
                timezone: tz,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.timezone).toBe(tz);
            }
        });

        it("accepts unicode display names", () => {
            const result = validateProfile({
                displayName: "José García 李华",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe("José García 李华");
            }
        });

        it("strips control characters via sanitisation", () => {
            const result = validateProfile({
                displayName: "Alice\u0000Bob\u0001",
                bio: "Hello\u0002World",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe("AliceBob");
                expect(result.data.bio).toBe("HelloWorld");
            }
        });

        it("normalises unicode to NFC form", () => {
            const composed = "é"; // U+00E9 (NFC precomposed)
            const decomposed = "e\u0301"; // U+0065 U+0301 (NFD decomposed)
            const result = validateProfile({
                displayName: decomposed,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe(composed);
            }
        });

        it("silently excludes unknown keys (Zod strip mode)", () => {
            const result = validateProfile({
                displayName: "Eve",
                extraField: "should be dropped",
                anotherOne: 42,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty("extraField");
                expect(result.data).not.toHaveProperty("anotherOne");
                expect(Object.keys(result.data)).toEqual([
                    "displayName",
                    "bio",
                    "website",
                    "timezone",
                ]);
            }
        });
    });

    describe("Invalid payloads", () => {
        it("rejects missing displayName", () => {
            const result = validateProfile({});
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.displayName).toBe(
                    "Invalid input: expected string, received undefined",
                );
            }
        });

        it("rejects displayName that is only whitespace", () => {
            const result = validateProfile({ displayName: "   " });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.displayName).toBe("Display name is required");
            }
        });

        it("rejects displayName exceeding max length", () => {
            const result = validateProfile({
                displayName: "A".repeat(81),
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.displayName).toBe(
                    "Display name must be 80 characters or fewer",
                );
            }
        });

        it("rejects bio exceeding max length", () => {
            const result = validateProfile({
                displayName: "Test",
                bio: "B".repeat(501),
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.bio).toBe(
                    "Bio must be 500 characters or fewer",
                );
            }
        });

        it("rejects invalid website URL", () => {
            const result = validateProfile({
                displayName: "Test",
                website: "not-a-url",
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.website).toBe("Website must be a valid URL");
            }
        });

        it("rejects website exceeding max length", () => {
            const path = "a".repeat(196);
            const website = `https://${path}.com`;
            const result = validateProfile({
                displayName: "Test",
                website,
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.website).toBe(
                    "Website URL must be 200 characters or fewer",
                );
            }
        });

        it("rejects timezone exceeding max length", () => {
            const result = validateProfile({
                displayName: "Test",
                timezone: "A".repeat(61),
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.timezone).toBe(
                    "Timezone must be 60 characters or fewer",
                );
            }
        });

        it("rejects non-string displayName", () => {
            const result = validateProfile({ displayName: 123 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.displayName).toBe(
                    "Invalid input: expected string, received number",
                );
            }
        });

        it("rejects null input", () => {
            const result = validateProfile(null);
            expect(result.success).toBe(false);
        });

        it("rejects undefined input", () => {
            const result = validateProfile(undefined);
            expect(result.success).toBe(false);
        });

        it("rejects array input", () => {
            const result = validateProfile([]);
            expect(result.success).toBe(false);
        });

        it("reports first-path error key for each invalid field", () => {
            const result = validateProfile({
                displayName: "",
                website: "bad",
                bio: "B".repeat(501),
                timezone: "A".repeat(61),
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.displayName).toBe("Display name is required");
                expect(result.errors.bio).toBe(
                    "Bio must be 500 characters or fewer",
                );
                expect(result.errors.website).toBe(
                    "Website must be a valid URL",
                );
                expect(result.errors.timezone).toBe(
                    "Timezone must be 60 characters or fewer",
                );
            }
        });

        it("does not include unknown keys in error output", () => {
            const result = validateProfile({
                displayName: "",
                unknownField: "whatever",
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(Object.keys(result.errors)).toEqual(["displayName"]);
            }
        });
    });

    describe("profileSchema (direct Zod schema)", () => {
        it("accepts a valid object", () => {
            const result = profileSchema.safeParse({
                displayName: "Test User",
                bio: "A short bio",
                website: "https://example.com",
                timezone: "America/Chicago",
            });
            expect(result.success).toBe(true);
        });

        it("strips unknown keys", () => {
            const result = profileSchema.safeParse({
                displayName: "Test",
                unknownKey: "value",
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty("unknownKey");
            }
        });
    });
});
