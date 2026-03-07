import { describe, expect, it } from "bun:test";
import { ALLOWED_CONFIG_SECTIONS, configTemplate, ensureChannelPluginsForEnabledChannels } from "../../src/gateway/config";

describe("ensureChannelPluginsForEnabledChannels", () => {
  it("includes tools as a root-level configurable section", () => {
    expect(ALLOWED_CONFIG_SECTIONS.has("tools")).toBe(true);
    expect(configTemplate()).toHaveProperty("tools");
  });

  it("adds wework and feishu plugin blocks when both channels are enabled", () => {
    const config: Record<string, unknown> = {
      channels: {
        wework: { enabled: true },
        feishu: { enable: true },
      },
    };

    ensureChannelPluginsForEnabledChannels(config);

    expect(config.plugins).toEqual({
      load: {
        paths: ["/data/openclaw/extensions/wework", "/data/openclaw/extensions/feishu"],
      },
      entries: {
        wework: { enabled: true },
        feishu: { enabled: true },
      },
    });
  });

  it("preserves existing plugin fields and appends the full required plugin set", () => {
    const config: Record<string, unknown> = {
      channels: {
        wework: { enabled: true },
        feishu: { enabled: false },
      },
      plugins: {
        load: {
          paths: ["/custom/path"],
        },
        allow: ["existing"],
        entries: {
          wework: { enabled: false, token: "abc" },
        },
      },
    };

    ensureChannelPluginsForEnabledChannels(config);

    expect(config.plugins).toEqual({
      load: {
        paths: ["/custom/path", "/data/openclaw/extensions/wework", "/data/openclaw/extensions/feishu"],
      },
      allow: ["existing"],
      entries: {
        wework: { enabled: true, token: "abc" },
        feishu: { enabled: true },
      },
    });
  });

  it("keeps config unchanged when no target channel is enabled", () => {
    const config: Record<string, unknown> = {
      channels: {
        wework: { enabled: false },
        feishu: { enabled: false },
      },
      plugins: {
        load: { paths: ["/keep"] },
      },
    };
    const before = JSON.parse(JSON.stringify(config));

    ensureChannelPluginsForEnabledChannels(config);

    expect(config).toEqual(before);
  });
});
