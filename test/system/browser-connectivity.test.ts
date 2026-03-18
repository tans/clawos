import { describe, expect, it } from "bun:test";
import {
  classifyCdpProbeConnectivity,
  normalizeCdpJsonVersionEndpoint,
} from "../../src/system/browser-connectivity";

describe("browser connectivity helpers", () => {
  it("normalizes cdp ws url to json/version endpoint", () => {
    const endpoint = normalizeCdpJsonVersionEndpoint("ws://127.0.0.1:18800/devtools/browser/abc");
    expect(endpoint).toEqual({
      cdpUrl: "ws://127.0.0.1:18800/devtools/browser/abc",
      jsonVersionUrl: "http://127.0.0.1:18800/json/version",
      port: 18800,
    });
  });

  it("normalizes secure cdp url to https json/version endpoint", () => {
    const endpoint = normalizeCdpJsonVersionEndpoint("wss://example.com:4443/devtools/browser/abc");
    expect(endpoint).toEqual({
      cdpUrl: "wss://example.com:4443/devtools/browser/abc",
      jsonVersionUrl: "https://example.com:4443/json/version",
      port: 4443,
    });
  });

  it("returns null for invalid cdp url", () => {
    expect(normalizeCdpJsonVersionEndpoint("not-a-url")).toBeNull();
  });

  it("classifies cdp connectivity for all direct/wsl combinations", () => {
    expect(classifyCdpProbeConnectivity(true, true)).toEqual({
      status: "ok",
      ready: true,
    });
    expect(classifyCdpProbeConnectivity(true, false)).toEqual({
      status: "local-only",
      ready: false,
    });
    expect(classifyCdpProbeConnectivity(false, true)).toEqual({
      status: "cdp-only",
      ready: true,
    });
    expect(classifyCdpProbeConnectivity(false, false)).toEqual({
      status: "probe-error",
      ready: false,
    });
  });
});
