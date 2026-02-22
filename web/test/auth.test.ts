import { describe, expect, it } from "bun:test";
import { parseBearerToken } from "../src/lib/auth";

describe("parseBearerToken", () => {
  it("parses valid bearer token", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("accepts lowercase bearer", () => {
    expect(parseBearerToken("bearer token-value")).toBe("token-value");
  });

  it("returns null for invalid header", () => {
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
  });
});
