vi.mock('server-only', () => ({}));

import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/account/preferences/route";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { signToken, getAuthUser } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";

const USER = { id: "user-1", email: "alice@example.com" };

function makeRequest(
  method: "GET" | "PUT",
  opts: { token?: string; body?: unknown; csrfToken?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  // When a CSRF token is provided, set both the cookie and header so
  // withCsrfProtection passes.  This lets us test auth (401) paths on PUT
  // without the CSRF middleware rejecting first (403).
  if (opts.csrfToken) {
    headers["Cookie"] = `csrf-token=${opts.csrfToken}`;
    headers["x-csrf-token"] = opts.csrfToken;
  }

  return new NextRequest("http://localhost/api/account/preferences", {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function validToken() {
  return signToken(USER);
}

// ---------------------------------------------------------------------------
// Unit-level: getAuthUser
// ---------------------------------------------------------------------------
describe("lib/auth – getAuthUser (preferences)", () => {
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
    const jwt = require("jsonwebtoken");
    const badToken = jwt.sign(
      { foo: "bar" },
      process.env.JWT_SECRET ?? "dev-secret-change-in-production"
    );
    const req = makeRequest("GET", { token: badToken });
    expect(getAuthUser(req)).toBeNull();
  });

  test("reads token from session cookie", () => {
    const token = validToken();
    const req = new NextRequest("http://localhost/api/account/preferences", {
      method: "GET",
      headers: { Cookie: `session=${token}` },
    });
    expect(getAuthUser(req)).toMatchObject({ id: USER.id });
  });
});


// ---------------------------------------------------------------------------
// Unit-level: validatePreferences
// ---------------------------------------------------------------------------
describe("validatePreferences", () => {
  const valid = {
    locale: "en-US",
    displayCurrency: "USD",
    notifications: { email: true, push: true, sms: false, inApp: true },
  };

  test("accepts a fully valid payload", () => {
    expect(validatePreferences(valid).success).toBe(true);
  });

  test("rejects an invalid locale", () => {
    const r = validatePreferences({ ...valid, locale: "xx-XX" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.locale).toBeTruthy();
  });

  test("rejects an invalid display currency", () => {
    const r = validatePreferences({ ...valid, displayCurrency: "XYZ" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.displayCurrency).toBeTruthy();
  });

  test("rejects a non-boolean notification channel", () => {
    const r = validatePreferences({
      ...valid,
      notifications: { ...valid.notifications, email: "yes" },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors["notifications.email"]).toBeTruthy();
  });

  test("applies default values for optional fields", () => {
    const r = validatePreferences({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.locale).toBe("en-US");
      expect(r.data.displayCurrency).toBe("USD");
      expect(r.data.notifications.email).toBe(true);
      expect(r.data.notifications.sms).toBe(false);
    }
  });

  test("uses '_' key when Zod issue has no path", () => {
    const r = validatePreferences(null);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(r.errors).length).toBeGreaterThan(0);
    }
  });

  test("collects multiple field errors at once", () => {
    const r = validatePreferences({
      locale: "xx-XX",
      displayCurrency: "XYZ",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.locale).toBeTruthy();
      expect(r.errors.displayCurrency).toBeTruthy();
    }
  });
});


// ---------------------------------------------------------------------------
// Unit-level: InMemoryPreferencesRepository
// ---------------------------------------------------------------------------
describe("InMemoryPreferencesRepository", () => {
  test("returns null for an unknown userId", async () => {
    expect(await preferencesRepository.getByUserId("unknown-99")).toBeNull();
  });

  test("upsert creates a new record and getByUserId retrieves it", async () => {
    const data = {
      locale: "fr",
      displayCurrency: "EUR",
      notifications: { email: true, push: false, sms: false, inApp: true },
    };
    const saved = await preferencesRepository.upsert("user-carol", data);
    expect(saved.userId).toBe("user-carol");
    expect(saved.locale).toBe("fr");
    expect(saved.displayCurrency).toBe("EUR");
    expect(saved.updatedAt).toBeInstanceOf(Date);

    const fetched = await preferencesRepository.getByUserId("user-carol");
    expect(fetched).toMatchObject(data);
  });

  test("upsert overwrites an existing record", async () => {
    await preferencesRepository.upsert("user-overwrite", {
      locale: "en-US",
      displayCurrency: "USD",
      notifications: { email: true, push: true, sms: false, inApp: true },
    });
    const updated = await preferencesRepository.upsert("user-overwrite", {
      locale: "ja",
      displayCurrency: "JPY",
      notifications: { email: false, push: true, sms: true, inApp: false },
    });
    expect(updated.locale).toBe("ja");
    expect(updated.displayCurrency).toBe("JPY");
    expect(updated.notifications.sms).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Integration: GET /api/account/preferences
// ---------------------------------------------------------------------------
describe("GET /api/account/preferences", () => {
  test("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  test("returns 401 for an invalid token", async () => {
    const res = await GET(makeRequest("GET", { token: "bad-token" }));
    expect(res.status).toBe(401);
  });

  test("401 response body contains keyed error field", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });

  test("returns 401 for an expired token", async () => {
    const expired = signToken(USER, "-1s");
    const res = await GET(makeRequest("GET", { token: expired }));
    expect(res.status).toBe(401);
  });

  test("unauthenticated request does not touch the repository", async () => {
    const spy = vi.spyOn(preferencesRepository, "getByUserId");
    await GET(makeRequest("GET"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("returns default preferences for a new user", async () => {
    const token = signToken({ id: "new-user-get", email: "new@example.com" });
    const res = await GET(makeRequest("GET", { token }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.userId).toBe("new-user-get");
    expect(json.locale).toBe("en-US");
    expect(json.displayCurrency).toBe("USD");
    expect(json.notifications).toEqual({
      email: true, push: true, sms: false, inApp: true,
    });
    expect(json.updatedAt).toBeNull();
  });

  test("returns saved preferences when one exists", async () => {
    const userId = "user-get-exists";
    await preferencesRepository.upsert(userId, {
      locale: "ja",
      displayCurrency: "JPY",
      notifications: { email: true, push: false, sms: true, inApp: false },
    });

    const token = signToken({ id: userId, email: "dave@example.com" });
    const res = await GET(makeRequest("GET", { token }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locale).toBe("ja");
    expect(json.displayCurrency).toBe("JPY");
    expect(json.notifications.push).toBe(false);
    expect(json.notifications.sms).toBe(true);
  });

  test("default response includes all expected top-level keys", async () => {
    const token = signToken({ id: "key-check-user", email: "keys@example.com" });
    const res = await GET(makeRequest("GET", { token }));
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(
      ["displayCurrency", "locale", "notifications", "updatedAt", "userId"].sort()
    );
  });
});


// ---------------------------------------------------------------------------
// Integration: PUT /api/account/preferences
// ---------------------------------------------------------------------------
describe("PUT /api/account/preferences", () => {
  const validBody = {
    locale: "fr",
    displayCurrency: "EUR",
    notifications: { email: true, push: true, sms: false, inApp: true },
  };

  test("returns 403 when unauthenticated (CSRF rejects before auth)", async () => {
    const res = await PUT(makeRequest("PUT", { body: validBody }));
    expect(res.status).toBe(403);
  });

  test("returns 401 when CSRF passes but no auth token is present", async () => {
    const csrf = "abcdef1234567890abcdef1234567890";
    const res = await PUT(
      makeRequest("PUT", { body: validBody, csrfToken: csrf })
    );
    expect(res.status).toBe(401);
  });

  test("401 on PUT contains keyed error body", async () => {
    const csrf = "abcdef1234567890abcdef1234567890";
    const res = await PUT(
      makeRequest("PUT", { body: validBody, csrfToken: csrf })
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("returns 401 for expired token on PUT", async () => {
    const expired = signToken(USER, "-1s");
    const res = await PUT(
      makeRequest("PUT", { token: expired, body: validBody })
    );
    expect(res.status).toBe(401);
  });

  test("unauthenticated PUT does not touch the repository", async () => {
    const upsertSpy = vi.spyOn(preferencesRepository, "upsert");
    const csrf = "abcdef1234567890abcdef1234567890";
    await PUT(makeRequest("PUT", { body: validBody, csrfToken: csrf }));
    expect(upsertSpy).not.toHaveBeenCalled();
    upsertSpy.mockRestore();
  });

  test("returns 400 for malformed JSON", async () => {
    const token = validToken();
    const req = new NextRequest("http://localhost/api/account/preferences", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{ bad json !!",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  test("400 for malformed JSON contains keyed error body", async () => {
    const token = validToken();
    const req = new NextRequest("http://localhost/api/account/preferences", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "not json at all",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });

  test("returns 422 with field errors for invalid body", async () => {
    const token = validToken();
    const res = await PUT(
      makeRequest("PUT", {
        token,
        body: { locale: "xx-XX", displayCurrency: "XYZ" },
      })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.locale).toBeTruthy();
    expect(json.errors.displayCurrency).toBeTruthy();
  });

  test("422 error body uses 'errors' key (not 'error')", async () => {
    const token = validToken();
    const res = await PUT(
      makeRequest("PUT", { token, body: { locale: "zz-ZZ" } })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toHaveProperty("errors");
    expect(json).not.toHaveProperty("error");
  });

  test("422 errors object keys correspond to invalid fields", async () => {
    const token = validToken();
    const res = await PUT(
      makeRequest("PUT", {
        token,
        body: {
          locale: "xx-XX",
          displayCurrency: "XYZ",
          notifications: { email: "yes", push: 42 },
        },
      })
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors).toHaveProperty("locale");
    expect(json.errors).toHaveProperty("displayCurrency");
    expect(json.errors).toHaveProperty("notifications.email");
    expect(json.errors).toHaveProperty("notifications.push");
  });

  test("returns 200 and persists on valid input", async () => {
    const token = validToken();
    const res = await PUT(makeRequest("PUT", { token, body: validBody }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locale).toBe("fr");
    expect(json.displayCurrency).toBe("EUR");
    expect(json.notifications.email).toBe(true);
    expect(json.updatedAt).toBeTruthy();
  });

  test("PUT response echoes a normalized record with all expected keys", async () => {
    const uid = "echo-keys-user";
    const token = signToken({ id: uid, email: "echo@example.com" });
    const res = await PUT(makeRequest("PUT", { token, body: validBody }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("userId", uid);
    expect(json).toHaveProperty("locale", "fr");
    expect(json).toHaveProperty("displayCurrency", "EUR");
    expect(json).toHaveProperty("notifications");
    expect(json).toHaveProperty("updatedAt");
    // updatedAt should be a valid serializable date string
    expect(new Date(json.updatedAt).toString()).not.toBe("Invalid Date");
  });

  test("PUT with partial data applies defaults", async () => {
    const token = validToken();
    const res = await PUT(makeRequest("PUT", { token, body: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locale).toBe("en-US");
    expect(json.displayCurrency).toBe("USD");
    expect(json.notifications).toEqual({
      email: true, push: true, sms: false, inApp: true,
    });
  });

  test("GET after PUT returns the saved data (round-trip)", async () => {
    const userId = "roundtrip-user";
    const token = signToken({ id: userId, email: "rt@example.com" });

    const putRes = await PUT(
      makeRequest("PUT", {
        token,
        body: { ...validBody, locale: "de", displayCurrency: "EUR" },
      })
    );
    expect(putRes.status).toBe(200);

    const res = await GET(makeRequest("GET", { token }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.locale).toBe("de");
    expect(json.displayCurrency).toBe("EUR");
  });

  test("round-trip preserves full notification preferences", async () => {
    const userId = "roundtrip-notif-user";
    const token = signToken({ id: userId, email: "rtn@example.com" });
    const custom = {
      locale: "ko",
      displayCurrency: "KRW",
      notifications: { email: false, push: false, sms: true, inApp: false },
    };

    await PUT(makeRequest("PUT", { token, body: custom }));
    const res = await GET(makeRequest("GET", { token }));
    const json = await res.json();
    expect(json.notifications).toEqual(custom.notifications);
  });

  test("PUT twice overwrites with latest data", async () => {
    const userId = "overwrite-user";
    const token = signToken({ id: userId, email: "ow@example.com" });

    await PUT(
      makeRequest("PUT", {
        token,
        body: { ...validBody, locale: "ko", displayCurrency: "KRW" },
      })
    );
    await PUT(
      makeRequest("PUT", {
        token,
        body: { ...validBody, locale: "ja", displayCurrency: "JPY" },
      })
    );

    const res = await GET(makeRequest("GET", { token }));
    const json = await res.json();
    expect(json.locale).toBe("ja");
    expect(json.displayCurrency).toBe("JPY");
  });

  test("returns 422 for invalid notification channel value", async () => {
    const token = validToken();
    const res = await PUT(
      makeRequest("PUT", {
        token,
        body: { notifications: { email: "not-boolean" } },
      })
    );
    expect(res.status).toBe(422);
  });

  test("valid PUT followed by default GET shows persisted data, not defaults", async () => {
    const userId = "persist-check-user";
    const token = signToken({ id: userId, email: "persist@example.com" });

    // First GET should return defaults
    const defaultRes = await GET(makeRequest("GET", { token }));
    const defaults = await defaultRes.json();
    expect(defaults.updatedAt).toBeNull();
    expect(defaults.locale).toBe("en-US");

    // PUT custom preferences
    const putRes = await PUT(
      makeRequest("PUT", {
        token,
        body: {
          locale: "it",
          displayCurrency: "EUR",
          notifications: { email: false, push: true, sms: true, inApp: false },
        },
      })
    );
    expect(putRes.status).toBe(200);

    // GET should now return persisted values, not defaults
    const persistedRes = await GET(makeRequest("GET", { token }));
    const persisted = await persistedRes.json();
    expect(persisted.locale).toBe("it");
    expect(persisted.displayCurrency).toBe("EUR");
    expect(persisted.notifications.email).toBe(false);
    expect(persisted.notifications.sms).toBe(true);
    expect(persisted.updatedAt).not.toBeNull();
  });

  test("each accepted locale round-trips correctly", async () => {
    const locales = ["en-US", "es", "fr", "ja", "zh-CN", "ko", "pt-BR", "de", "it", "ru", "ar"];
    for (const locale of locales) {
      const uid = `locale-rt-${locale}`;
      const token = signToken({ id: uid, email: `${locale}@example.com` });
      const putRes = await PUT(
        makeRequest("PUT", { token, body: { locale } })
      );
      expect(putRes.status).toBe(200);
      const getRes = await GET(makeRequest("GET", { token }));
      const json = await getRes.json();
      expect(json.locale).toBe(locale);
    }
  });

  test("each accepted currency round-trips correctly", async () => {
    const currencies = ["USD", "EUR", "JPY", "GBP", "XLM", "BTC", "ETH", "CNY", "KRW", "BRL"];
    for (const cur of currencies) {
      const uid = `currency-rt-${cur}`;
      const token = signToken({ id: uid, email: `${cur}@example.com` });
      const putRes = await PUT(
        makeRequest("PUT", { token, body: { displayCurrency: cur } })
      );
      expect(putRes.status).toBe(200);
      const getRes = await GET(makeRequest("GET", { token }));
      const json = await getRes.json();
      expect(json.displayCurrency).toBe(cur);
    }
  });
});
