import { describe, expect, it } from "bun:test";
import { readConfigSectionSchema } from "../../../app/server/config/schema";

describe("config schema section loader", () => {
  it("reads browser section schema from config.schema.json", () => {
    const schema = readConfigSectionSchema("browser");
    expect(schema.type).toBe("object");

    const properties = schema.properties as Record<string, unknown>;
    expect(properties).toBeTruthy();
    expect(properties.cdpUrl).toBeTruthy();
    expect(properties.attachOnly).toBeTruthy();
  });

  it("throws when section schema is missing", () => {
    expect(() => readConfigSectionSchema("__not_found__")).toThrow();
  });
});
