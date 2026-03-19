import { describe, expect, it } from "bun:test";
import { computeDesktopControlPort } from "../../app/src/bun/single-instance";

describe("desktop single-instance control port", () => {
  it("uses env control port when valid", () => {
    expect(computeDesktopControlPort("19090")).toBe(19090);
  });

  it("falls back to default control port when env is invalid", () => {
    expect(computeDesktopControlPort("abc")).toBe(8151);
  });
});
