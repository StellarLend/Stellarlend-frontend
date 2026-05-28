import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/account/profile/route";
import { profileRepository } from "@/lib/account/repository";
import { signToken, getAuthUser } from "@/lib/auth";
import { validateProfile } from "@/lib/account/validation";

const USER = { id: "user-1", email: "alice@example.com" };

function makeRequest(
    method: "GET" | "PUT",
    opts: { token?: string; body?: unknown } = {}
): NextRequest {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

    return new NextRequest("http://localhost/api/account/profile", {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
}

function validToken() {
    return signToken(USER);
}

describe("lib/auth – getAuthUser", () => {
    test("returns null when no token is present", () => {
        const req = makeRequest("GET");
        expect(getAuthUser(req)).toBeNull();
    });

    test("returns null for a malformed token", () => {
        const req = makeRequest("GET", { token: "not.a.jwt" });
        expect(getAuthUser(req)).toBeNull();
    });

    test("returns null for an expired token", () => {
        const expired = signToken(USER, "-1s");
        const req = makeRequest("GET", { token: expired });
        expect(getAuthUser(req)).toBeNull();
    });

    test("returns AuthUser for a valid Bearer token", () => {
        const req = makeRequest("GET", { token: validToken() });
        expect(getAuthUser(req)).toMatchObject({ id: USER.id, email: USER.email });
    });

    test("returns null when JWT payload lacks sub or email fields", () => {
        // Sign a token whose payload doesn't carry sub/email
        const jwt = require("jsonwebtoken");
        const badToken = jwt.sign({ foo: "bar" }, process.env.JWT_SECRET ?? "dev-secret-change-in-production");
        const req = makeRequest("GET", { token: badToken });
        expect(getAuthUser(req)).toBeNull();
    });

    test("reads token from session cookie", () => {
        const token = validToken();
        const req = new NextRequest("http://localhost/api/account/profile", {
            method: "GET",
            headers: { Cookie: `session=${token}` },
        });
        expect(getAuthUser(req)).toMatchObject({ id: USER.id });
    });
});


describe("validateProfile", () => {
    const valid = {
        displayName: "Alice",
        bio: "Hello",
        website: "https://alice.dev",
        timezone: "UTC",
    };

    test("accepts a fully valid payload", () => {
        expect(validateProfile(valid).success).toBe(true);
    });

    test("requires displayName", () => {
        const r = validateProfile({ ...valid, displayName: "" });
        expect(r.success).toBe(false);
        if (!r.success) expect(r.errors.displayName).toBeTruthy();
    });

    test("rejects displayName over 80 chars", () => {
        const r = validateProfile({ ...valid, displayName: "x".repeat(81) });
        expect(r.success).toBe(false);
        if (!r.success) expect(r.errors.displayName).toBeTruthy();
    });

    test("rejects bio over 500 chars", () => {
        const r = validateProfile({ ...valid, bio: "x".repeat(501) });
        expect(r.success).toBe(false);
        if (!r.success) expect(r.errors.bio).toBeTruthy();
    });

    test("rejects an invalid website URL", () => {
        const r = validateProfile({ ...valid, website: "not-a-url" });
        expect(r.success).toBe(false);
        if (!r.success) expect(r.errors.website).toBeTruthy();
    });

    test("accepts an empty website string", () => {
        const r = validateProfile({ ...valid, website: "" });
        expect(r.success).toBe(true);
    });

    test("applies default values for optional fields", () => {
        const r = validateProfile({ displayName: "Bob" });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.bio).toBe("");
            expect(r.data.website).toBe("");
            expect(r.data.timezone).toBe("UTC");
        }
    });

    test("trims whitespace from displayName", () => {
        const r = validateProfile({ ...valid, displayName: "  Alice  " });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.displayName).toBe("Alice");
    });

    test("uses '_' key when Zod issue has no path", () => {
        // Pass a non-object to trigger a top-level Zod error with empty path
        const r = validateProfile(null);
        expect(r.success).toBe(false);
        if (!r.success) {
            // Should have at least one error key
            expect(Object.keys(r.errors).length).toBeGreaterThan(0);
        }
    });

    test("collects multiple field errors at once", () => {
        const r = validateProfile({ displayName: "", bio: "x".repeat(501) });
        expect(r.success).toBe(false);
        if (!r.success) {
            expect(r.errors.displayName).toBeTruthy();
            expect(r.errors.bio).toBeTruthy();
        }
    });
});


describe("InMemoryProfileRepository", () => {
    test("returns null for an unknown userId", async () => {
        expect(await profileRepository.getByUserId("unknown-99")).toBeNull();
    });

    test("upsert creates a new record and getByUserId retrieves it", async () => {
        const data = { displayName: "Carol", bio: "", website: "", timezone: "UTC" };
        const saved = await profileRepository.upsert("user-carol", data);
        expect(saved.userId).toBe("user-carol");
        expect(saved.displayName).toBe("Carol");
        expect(saved.updatedAt).toBeInstanceOf(Date);

        const fetched = await profileRepository.getByUserId("user-carol");
        expect(fetched).toMatchObject(data);
    });

    test("upsert overwrites an existing record", async () => {
        await profileRepository.upsert("user-overwrite", {
            displayName: "Old",
            bio: "",
            website: "",
            timezone: "UTC",
        });
        const updated = await profileRepository.upsert("user-overwrite", {
            displayName: "New",
            bio: "Updated",
            website: "",
            timezone: "Europe/London",
        });
        expect(updated.displayName).toBe("New");
        expect(updated.bio).toBe("Updated");
    });
});


describe("GET /api/account/profile", () => {
    test("returns 401 when unauthenticated", async () => {
        const res = await GET(makeRequest("GET"));
        expect(res.status).toBe(401);
    });

    test("returns 401 for an invalid token", async () => {
        const res = await GET(makeRequest("GET", { token: "bad-token" }));
        expect(res.status).toBe(401);
    });

    test("returns default profile for a new user", async () => {
        // Use a unique userId to avoid cross-test contamination
        const token = signToken({ id: "new-user-get", email: "new@example.com" });
        const res = await GET(makeRequest("GET", { token }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.userId).toBe("new-user-get");
        expect(json.displayName).toBe("");
        expect(json.updatedAt).toBeNull();
    });

    test("returns saved profile when one exists", async () => {
        const userId = "user-get-exists";
        await profileRepository.upsert(userId, {
            displayName: "Dave",
            bio: "Bio here",
            website: "https://dave.io",
            timezone: "Asia/Tokyo",
        });

        const token = signToken({ id: userId, email: "dave@example.com" });
        const res = await GET(makeRequest("GET", { token }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.displayName).toBe("Dave");
        expect(json.bio).toBe("Bio here");
        expect(json.website).toBe("https://dave.io");
    });
});


describe("PUT /api/account/profile", () => {
    const validBody = {
        displayName: "Alice",
        bio: "Hello world",
        website: "https://alice.dev",
        timezone: "America/New_York",
    };

    test("returns 401 when unauthenticated", async () => {
        const res = await PUT(makeRequest("PUT", { body: validBody }));
        expect(res.status).toBe(401);
    });

    test("returns 400 for malformed JSON", async () => {
        const token = validToken();
        const req = new NextRequest("http://localhost/api/account/profile", {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: "{ bad json !!",
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    test("returns 422 with field errors for invalid body", async () => {
        const token = validToken();
        const res = await PUT(
            makeRequest("PUT", {
                token,
                body: { displayName: "", website: "not-a-url" },
            })
        );
        expect(res.status).toBe(422);
        const json = await res.json();
        expect(json.errors.displayName).toBeTruthy();
        expect(json.errors.website).toBeTruthy();
    });

    test("returns 200 and persists on valid input", async () => {
        const token = validToken();
        const res = await PUT(makeRequest("PUT", { token, body: validBody }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.displayName).toBe("Alice");
        expect(json.website).toBe("https://alice.dev");
        expect(json.updatedAt).toBeTruthy();
    });

    test("GET after PUT returns the saved data", async () => {
        const userId = "roundtrip-user";
        const token = signToken({ id: userId, email: "rt@example.com" });

        await PUT(makeRequest("PUT", { token, body: { ...validBody, displayName: "Roundtrip" } }));
        const res = await GET(makeRequest("GET", { token }));
        const json = await res.json();
        expect(json.displayName).toBe("Roundtrip");
    });

    test("PUT twice overwrites with latest data", async () => {
        const userId = "overwrite-user";
        const token = signToken({ id: userId, email: "ow@example.com" });

        await PUT(makeRequest("PUT", { token, body: { ...validBody, displayName: "First" } }));
        await PUT(makeRequest("PUT", { token, body: { ...validBody, displayName: "Second" } }));

        const res = await GET(makeRequest("GET", { token }));
        const json = await res.json();
        expect(json.displayName).toBe("Second");
    });

    test("accepts profile with empty optional fields", async () => {
        const token = validToken();
        const res = await PUT(
            makeRequest("PUT", { token, body: { displayName: "Minimal" } })
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.bio).toBe("");
        expect(json.website).toBe("");
        expect(json.timezone).toBe("UTC");
    });

    test("displayName is trimmed before persisting", async () => {
        const token = validToken();
        const res = await PUT(
            makeRequest("PUT", { token, body: { displayName: "  Padded  " } })
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.displayName).toBe("Padded");
    });
});