import { AuthError, UpstreamError, ValidationError } from "./errors";

describe("API error classes", () => {
  it("ValidationError carries status 400", () => {
    const err = new ValidationError("bad input");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("ValidationError");
  });

  it("AuthError carries status 401", () => {
    expect(new AuthError("nope").statusCode).toBe(401);
  });

  it("UpstreamError carries status 502", () => {
    expect(new UpstreamError("horizon down").statusCode).toBe(502);
  });
});
