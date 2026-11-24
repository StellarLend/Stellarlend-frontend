import { describe, expect, it } from "vitest";
import { getSiteUrl } from "@/lib/site";
import robots from "./robots";

describe("robots metadata route", () => {
  it("disallows private routes and links the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        disallow: ["/admin/", "/api/"],
      },
      sitemap: `${getSiteUrl()}/sitemap.xml`,
    });
  });
});
