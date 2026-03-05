import { describe, expect, it } from "bun:test";
import { normalizeLegacyChannelAliases } from "../../src/openclaw/cli";

describe("openclaw cli channel compatibility", () => {
  it("migrates channels.wework to channels.wecom", () => {
    const input = {
      channels: {
        wework: { enabled: true, accounts: {} },
      },
    } as Record<string, unknown>;

    const result = normalizeLegacyChannelAliases(input);
    expect(result.changed).toBe(true);
    const channels = result.config.channels as Record<string, unknown>;
    expect(channels.wecom).toEqual({ enabled: true, accounts: {} });
    expect(Object.prototype.hasOwnProperty.call(channels, "wework")).toBe(false);
  });

  it("keeps existing channels.wecom and removes channels.wework", () => {
    const input = {
      channels: {
        wecom: { enabled: false },
        wework: { enabled: true },
      },
    } as Record<string, unknown>;

    const result = normalizeLegacyChannelAliases(input);
    expect(result.changed).toBe(true);
    const channels = result.config.channels as Record<string, unknown>;
    expect(channels.wecom).toEqual({ enabled: false });
    expect(Object.prototype.hasOwnProperty.call(channels, "wework")).toBe(false);
  });

  it("does nothing when wework alias is absent", () => {
    const input = {
      channels: {
        wecom: { enabled: true },
      },
    } as Record<string, unknown>;

    const result = normalizeLegacyChannelAliases(input);
    expect(result.changed).toBe(false);
    expect(result.config).toBe(input);
  });
});
