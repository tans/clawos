import { describe, expect, it } from "bun:test";
import {
  buildPm2DeployPlan,
  buildProxyConfigPayload,
  buildProxyWebsiteCreatePayload,
  createOnePanelToken,
  ensureWebsiteForDeploy,
  parseExportedEnv,
  pickWebsiteMatch,
} from "../../../scripts/deploy_to_1panel";

describe("deploy_to_1panel helpers", () => {
  it("parses export-based env files", () => {
    const parsed = parseExportedEnv(`
export ONEPANEL_BASE_URL="http://clawos.cc:8090"
export ONEPANEL_API_KEY="secret-key"
# comment
PLAIN_VALUE=test
`);

    expect(parsed).toEqual({
      ONEPANEL_BASE_URL: "http://clawos.cc:8090",
      ONEPANEL_API_KEY: "secret-key",
      PLAIN_VALUE: "test",
    });
  });

  it("creates the signed 1Panel token", () => {
    expect(createOnePanelToken("key", "123")).toBe("8af7d8e66bbb47a631c7ab9acdb522da");
  });

  it("builds the proxy-website create payload", () => {
    expect(buildProxyWebsiteCreatePayload("clawos.cc", 2, "127.0.0.1:26222")).toEqual({
      alias: "clawos.cc",
      type: "proxy",
      appType: "new",
      webSiteGroupID: 2,
      proxy: "http://127.0.0.1:26222",
      domains: [
        {
          domain: "clawos.cc",
          port: 80,
          ssl: false,
        },
      ],
    });
  });

  it("prefers exact primary-domain or alias matches", () => {
    const match = pickWebsiteMatch(
      [
        { id: 1, primaryDomain: "foo.example.com", alias: "foo.example.com" },
        { id: 2, primaryDomain: "clawos.cc:80", alias: "clawos.cc" },
      ],
      "clawos.cc",
    );

    expect(match?.id).toBe(2);
  });

  it("allows dry-run to continue when the website does not exist yet", async () => {
    const result = await ensureWebsiteForDeploy({
      domain: "clawos.cc",
      groupId: 2,
      dryRun: true,
      search: async () => undefined,
      create: async () => {
        throw new Error("dry-run should not create");
      },
    });

    expect(result).toEqual({
      website: undefined,
      willCreate: true,
    });
  });

  it("plans creating the root proxy config when none exists", () => {
    expect(buildProxyConfigPayload(12, "127.0.0.1:26222")).toEqual({
      id: 12,
      operate: "create",
      name: "root",
      modifier: "^~",
      match: "/",
      proxyPass: "http://127.0.0.1:26222",
      proxyHost: "$host",
      cache: false,
      enable: true,
      cacheTime: 0,
      cacheUnit: "s",
      serverCacheTime: 0,
      serverCacheUnit: "s",
      sni: false,
      sslVerify: false,
      cors: false,
      allowOrigins: "",
      allowMethods: "",
      allowHeaders: "",
      allowCredentials: false,
      preflight: false,
      replaces: {},
    });
  });

  it("plans editing the root proxy config when one already exists", () => {
    expect(
      buildProxyConfigPayload(12, "127.0.0.1:26222", {
        name: "root",
        modifier: "=",
        match: "/health",
        proxyHost: "example.internal",
        cache: true,
        cacheTime: 30,
        cacheUnit: "m",
        serverCacheTime: 1,
        serverCacheUnit: "h",
        sni: true,
        sslVerify: true,
        cors: true,
        allowOrigins: "*",
        allowMethods: "GET,POST",
        allowHeaders: "Authorization",
        allowCredentials: true,
        preflight: true,
        replaces: { a: "b" },
      }),
    ).toEqual({
      id: 12,
      operate: "edit",
      name: "root",
      modifier: "=",
      match: "/health",
      proxyPass: "http://127.0.0.1:26222",
      proxyHost: "example.internal",
      cache: true,
      enable: true,
      cacheTime: 30,
      cacheUnit: "m",
      serverCacheTime: 1,
      serverCacheUnit: "h",
      sni: true,
      sslVerify: true,
      cors: true,
      allowOrigins: "*",
      allowMethods: "GET,POST",
      allowHeaders: "Authorization",
      allowCredentials: true,
      preflight: true,
      replaces: { a: "b" },
    });
  });

  it("builds the pm2-based local deploy plan", () => {
    expect(buildPm2DeployPlan("/repo/web", "clawos")).toEqual([
      {
        cwd: "/repo/web",
        label: "bun install",
        command: ["bun", "install"],
      },
      {
        cwd: "/repo/web",
        label: "bun run tailwind:build",
        command: ["bun", "run", "tailwind:build"],
      },
      {
        cwd: "/repo/web",
        label: "pm2 describe clawos",
        command: ["pm2", "describe", "clawos"],
      },
      {
        cwd: "/repo/web",
        label: "pm2 start ecosystem.config.cjs --only clawos",
        command: ["pm2", "start", "ecosystem.config.cjs", "--only", "clawos"],
      },
      {
        cwd: "/repo/web",
        label: "pm2 restart clawos",
        command: ["pm2", "restart", "clawos"],
      },
    ]);
  });
});
