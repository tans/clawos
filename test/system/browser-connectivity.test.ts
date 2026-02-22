import { describe, expect, it } from "bun:test";
import { buildPortProxyCommand, normalizeCdpJsonVersionEndpoint } from "../../src/system/browser-connectivity";

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

  it("builds portproxy command with listen port +1", () => {
    expect(buildPortProxyCommand(18800)).toBe(
      "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=18801 connectaddress=127.0.0.1 connectport=18800"
    );
  });
});

