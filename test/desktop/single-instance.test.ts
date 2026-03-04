import { describe, expect, it } from "bun:test";
import { computeDesktopControlPort } from "../../src/bun/single-instance";

describe("desktop single-instance control port", () => {
  it("uses env control port when valid", () => {
    expect(computeDesktopControlPort(8080, "19090")).toBe(19090);
  });

  it("falls back to derived port when env is invalid", () => {
    expect(computeDesktopControlPort(8080, "abc")).toBe(8151);
  });

  it("uses fallback subtraction when derived port overflows", () => {
    expect(computeDesktopControlPort(65500, undefined)).toBe(65429);
  });
});
