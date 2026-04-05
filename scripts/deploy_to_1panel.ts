import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

type WebsiteListItem = {
  id: number;
  primaryDomain?: string;
  alias?: string;
  type?: string;
};

type WebsiteDetail = {
  id: number;
  primaryDomain?: string;
  alias?: string;
  type?: string;
};

type GroupInfo = {
  id: number;
  name?: string;
  type?: string;
  isDefault?: boolean;
};

type WebsiteProxyConfig = {
  name?: string;
  modifier?: string;
  match?: string;
  proxyPass?: string;
  proxyHost?: string;
  cache?: boolean;
  enable?: boolean;
  cacheTime?: number;
  cacheUnit?: string;
  serverCacheTime?: number;
  serverCacheUnit?: string;
  sni?: boolean;
  sslVerify?: boolean;
  cors?: boolean;
  allowOrigins?: string;
  allowMethods?: string;
  allowHeaders?: string;
  allowCredentials?: boolean;
  preflight?: boolean;
  replaces?: Record<string, string>;
};

type ProxyConfigPayload = {
  id: number;
  operate: "create" | "edit";
  enable: boolean;
  cache: boolean;
  cacheTime: number;
  cacheUnit: string;
  serverCacheTime: number;
  serverCacheUnit: string;
  name: string;
  modifier: string;
  match: string;
  proxyPass: string;
  proxyHost: string;
  replaces: Record<string, string>;
  sni: boolean;
  sslVerify: boolean;
  cors: boolean;
  allowOrigins: string;
  allowMethods: string;
  allowHeaders: string;
  allowCredentials: boolean;
  preflight: boolean;
};

type WebsiteCreatePayload = {
  alias: string;
  type: "proxy";
  appType: "new";
  webSiteGroupID: number;
  proxy: string;
  domains: Array<{
    domain: string;
    port: number;
    ssl: boolean;
  }>;
};

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

type SearchResult<T> = {
  total: number;
  items: T[] | null;
};

type WebsiteResolution = {
  website?: WebsiteListItem;
  willCreate: boolean;
};

type LocalDeployStep = {
  cwd: string;
  label: string;
  command: string[];
};

type Options = {
  domain: string;
  envFile: string;
  webDir: string;
  pm2App: string;
  proxyHost: string;
  proxyPort: number;
  baseUrl?: string;
  apiKey?: string;
  skipWebsite: boolean;
  skipLocalDeploy: boolean;
  dryRun: boolean;
};

export function parseExportedEnv(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

export function createOnePanelToken(apiKey: string, timestamp: string): string {
  return createHash("md5").update(`1panel${apiKey}${timestamp}`).digest("hex");
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizeDomainCandidate(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:(80|443)$/, "");
}

function normalizeProxyTarget(target: string): string {
  return target.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function normalizeProxyPass(target: string): string {
  const normalized = target.trim();
  if (!normalized) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/+$/, "");
  }
  return `http://${normalized.replace(/\/+$/, "")}`;
}

export function pickWebsiteMatch(items: WebsiteListItem[], domain: string): WebsiteListItem | undefined {
  const normalizedTarget = normalizeDomainCandidate(domain);
  return items.find((item) => {
    const primaryDomain = normalizeDomainCandidate(item.primaryDomain);
    const alias = normalizeDomainCandidate(item.alias);
    return primaryDomain === normalizedTarget || alias === normalizedTarget;
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertDirectory(path: string, label: string): Promise<void> {
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
  if (!info.isDirectory()) {
    throw new Error(`${label} is not a directory: ${path}`);
  }
}

async function loadEnvFile(envFilePath: string): Promise<Record<string, string>> {
  if (!(await fileExists(envFilePath))) {
    return {};
  }
  return parseExportedEnv(await readFile(envFilePath, "utf-8"));
}

export function buildProxyWebsiteCreatePayload(
  domain: string,
  groupId: number,
  proxyTarget: string,
): WebsiteCreatePayload {
  return {
    alias: domain.toLowerCase(),
    type: "proxy",
    appType: "new",
    webSiteGroupID: groupId,
    proxy: normalizeProxyPass(proxyTarget),
    domains: [
      {
        domain,
        port: 80,
        ssl: false,
      },
    ],
  };
}

export function buildProxyConfigPayload(
  websiteId: number,
  proxyTarget: string,
  existing?: WebsiteProxyConfig,
): ProxyConfigPayload {
  return {
    id: websiteId,
    operate: existing ? "edit" : "create",
    name: existing?.name || "root",
    modifier: existing?.modifier || "^~",
    match: existing?.match || "/",
    proxyPass: normalizeProxyPass(proxyTarget),
    proxyHost: existing?.proxyHost || "$host",
    cache: existing?.cache ?? false,
    enable: true,
    cacheTime: existing?.cacheTime ?? 0,
    cacheUnit: existing?.cacheUnit || "s",
    serverCacheTime: existing?.serverCacheTime ?? 0,
    serverCacheUnit: existing?.serverCacheUnit || "s",
    sni: existing?.sni ?? false,
    sslVerify: existing?.sslVerify ?? false,
    cors: existing?.cors ?? false,
    allowOrigins: existing?.allowOrigins || "",
    allowMethods: existing?.allowMethods || "",
    allowHeaders: existing?.allowHeaders || "",
    allowCredentials: existing?.allowCredentials ?? false,
    preflight: existing?.preflight ?? false,
    replaces: existing?.replaces || {},
  };
}

export function buildPm2DeployPlan(webDir: string, pm2App: string): LocalDeployStep[] {
  return [
    {
      cwd: webDir,
      label: "bun install",
      command: ["bun", "install"],
    },
    {
      cwd: webDir,
      label: "bun run tailwind:build",
      command: ["bun", "run", "tailwind:build"],
    },
    {
      cwd: webDir,
      label: `pm2 describe ${pm2App}`,
      command: ["pm2", "describe", pm2App],
    },
    {
      cwd: webDir,
      label: `pm2 start ecosystem.config.cjs --only ${pm2App}`,
      command: ["pm2", "start", "ecosystem.config.cjs", "--only", pm2App],
    },
    {
      cwd: webDir,
      label: `pm2 restart ${pm2App}`,
      command: ["pm2", "restart", pm2App],
    },
  ];
}

export async function ensureWebsiteForDeploy(input: {
  domain: string;
  groupId: number;
  dryRun: boolean;
  search: () => Promise<WebsiteListItem | undefined>;
  create: () => Promise<void>;
}): Promise<WebsiteResolution> {
  const existingWebsite = await input.search();
  if (existingWebsite) {
    return {
      website: existingWebsite,
      willCreate: false,
    };
  }

  if (input.dryRun) {
    return {
      website: undefined,
      willCreate: true,
    };
  }

  await input.create();
  const createdWebsite = await input.search();
  if (!createdWebsite) {
    throw new Error(`Website ${input.domain} was not found after create/search.`);
  }

  return {
    website: createdWebsite,
    willCreate: true,
  };
}

function printUsage(): void {
  console.log(`Deploy clawos web to 1Panel with PM2

Usage:
  bun run scripts/deploy_to_1panel.ts [options]

Options:
  --domain <domain>         Website domain, default clawos.cc
  --web-dir <path>          Web project directory, default ./web
  --pm2-app <name>          PM2 app name, default clawos
  --proxy-host <host>       Reverse-proxy upstream host, default 127.0.0.1
  --proxy-port <port>       Reverse-proxy upstream port, default 26222
  --env-file <path>         Env file path, default ./.env
  --base-url <url>          1Panel base URL, default from ONEPANEL_BASE_URL
  --api-key <key>           1Panel API key, default from ONEPANEL_API_KEY
  --skip-website            Skip 1Panel website provisioning
  --skip-local-deploy       Skip local Bun/PM2 deployment
  --dry-run                 Print actions without changing PM2 or 1Panel
  -h, --help                Show help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    domain: "clawos.cc",
    envFile: resolve(process.cwd(), ".env"),
    webDir: resolve(process.cwd(), "web"),
    pm2App: "clawos",
    proxyHost: "127.0.0.1",
    proxyPort: 26222,
    skipWebsite: false,
    skipLocalDeploy: false,
    dryRun: false,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--skip-website") {
      options.skipWebsite = true;
      continue;
    }
    if (arg === "--skip-local-deploy") {
      options.skipLocalDeploy = true;
      continue;
    }

    if (arg.startsWith("--domain=")) {
      options.domain = arg.slice("--domain=".length).trim();
      continue;
    }
    if (arg.startsWith("--web-dir=")) {
      options.webDir = resolve(process.cwd(), arg.slice("--web-dir=".length));
      continue;
    }
    if (arg.startsWith("--pm2-app=")) {
      options.pm2App = arg.slice("--pm2-app=".length).trim();
      continue;
    }
    if (arg.startsWith("--proxy-host=")) {
      options.proxyHost = arg.slice("--proxy-host=".length).trim();
      continue;
    }
    if (arg.startsWith("--proxy-port=")) {
      options.proxyPort = Number.parseInt(arg.slice("--proxy-port=".length), 10);
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      options.envFile = resolve(process.cwd(), arg.slice("--env-file=".length));
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim();
      continue;
    }
    if (arg.startsWith("--api-key=")) {
      options.apiKey = arg.slice("--api-key=".length).trim();
      continue;
    }

    const value = args.shift();
    if (!value) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--domain":
        options.domain = value.trim();
        break;
      case "--web-dir":
        options.webDir = resolve(process.cwd(), value);
        break;
      case "--pm2-app":
        options.pm2App = value.trim();
        break;
      case "--proxy-host":
        options.proxyHost = value.trim();
        break;
      case "--proxy-port":
        options.proxyPort = Number.parseInt(value, 10);
        break;
      case "--env-file":
        options.envFile = resolve(process.cwd(), value);
        break;
      case "--base-url":
        options.baseUrl = value.trim();
        break;
      case "--api-key":
        options.apiKey = value.trim();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.proxyPort) || options.proxyPort <= 0 || options.proxyPort > 65535) {
    throw new Error(`Invalid --proxy-port: ${options.proxyPort}`);
  }

  return options;
}

class OnePanelApiError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
    this.name = "OnePanelApiError";
  }
}

class OnePanelClient {
  constructor(
    readonly baseUrl: string,
    readonly apiKey: string,
  ) {}

  private createSignedHeaders(extraHeaders?: HeadersInit): Headers {
    const timestamp = Date.now().toString();
    const token = createOnePanelToken(this.apiKey, timestamp);
    const headers = new Headers(extraHeaders);
    headers.set("1Panel-Timestamp", timestamp);
    headers.set("1Panel-Token", token);
    return headers;
  }

  async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = this.createSignedHeaders({ Accept: "application/json" });
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: payload,
    });

    if (!response.ok) {
      throw new OnePanelApiError(`1Panel HTTP ${response.status} on ${method} ${path}`, response.status);
    }

    const envelope = (await response.json()) as ApiEnvelope<T>;
    if (typeof envelope?.code !== "number") {
      throw new OnePanelApiError(`Unexpected 1Panel response on ${method} ${path}`);
    }
    if (envelope.code !== 200) {
      throw new OnePanelApiError(envelope.message || `1Panel API error on ${method} ${path}`, envelope.code);
    }
    return envelope.data;
  }
}

async function ensureOpenRestyInstalled(client: OnePanelClient): Promise<void> {
  const data = await client.requestJson<unknown>("GET", "/api/v2/apps/services/openresty");
  if (!data) {
    throw new Error("1Panel 中未安装 OpenResty，无法创建或管理代理站点。请先在应用商店安装 OpenResty。");
  }
}

async function getDefaultWebsiteGroupId(client: OnePanelClient): Promise<number> {
  const groups = await client.requestJson<GroupInfo[]>("POST", "/api/v2/groups/search", { type: "website" });
  const defaultGroup = groups.find((group) => group.isDefault) || groups[0];
  if (!defaultGroup?.id) {
    throw new Error("未找到 1Panel 网站分组，无法创建站点。");
  }
  return defaultGroup.id;
}

async function searchWebsite(client: OnePanelClient, domain: string): Promise<WebsiteListItem | undefined> {
  const result = await client.requestJson<SearchResult<WebsiteListItem>>("POST", "/api/v2/websites/search", {
    page: 1,
    pageSize: 100,
    name: domain,
    websiteGroupId: 0,
    orderBy: "created_at",
    order: "descending",
  });
  return pickWebsiteMatch(result.items || [], domain);
}

async function createProxyWebsite(
  client: OnePanelClient,
  domain: string,
  groupId: number,
  proxyTarget: string,
): Promise<void> {
  const payload = buildProxyWebsiteCreatePayload(domain, groupId, proxyTarget);
  await client.requestJson<unknown>("POST", "/api/v2/websites", payload);
}

async function getWebsiteDetail(client: OnePanelClient, websiteId: number): Promise<WebsiteDetail> {
  return client.requestJson<WebsiteDetail>("GET", `/api/v2/websites/${websiteId}`);
}

async function getWebsiteProxyConfigs(client: OnePanelClient, websiteId: number): Promise<WebsiteProxyConfig[]> {
  return client.requestJson<WebsiteProxyConfig[]>("POST", "/api/v2/websites/proxies", {
    id: websiteId,
  });
}

async function upsertWebsiteProxyConfig(
  client: OnePanelClient,
  payload: ProxyConfigPayload,
): Promise<void> {
  await client.requestJson<unknown>("POST", "/api/v2/websites/proxies/update", payload);
}

function logStep(message: string): void {
  console.log(`[deploy:1panel] ${message}`);
}

async function runCommand(step: LocalDeployStep, allowFailure = false): Promise<number> {
  const proc = Bun.spawn({
    cmd: step.command,
    cwd: step.cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0 && !allowFailure) {
    throw new Error(`${step.label} failed with exit code ${exitCode}`);
  }
  return exitCode;
}

async function runLocalDeploy(webDir: string, pm2App: string, dryRun: boolean): Promise<void> {
  const steps = buildPm2DeployPlan(webDir, pm2App);

  if (dryRun) {
    for (const step of steps) {
      logStep(`dry-run: (${step.cwd}) ${step.command.join(" ")}`);
    }
    return;
  }

  await runCommand(steps[0]);
  await runCommand(steps[1]);
  const describeExitCode = await runCommand(steps[2], true);
  if (describeExitCode === 0) {
    await runCommand(steps[4]);
    return;
  }
  await runCommand(steps[3]);
}

async function ensureWebsiteProxy(
  client: OnePanelClient,
  websiteId: number,
  proxyTarget: string,
  dryRun: boolean,
): Promise<void> {
  const targetProxyPass = normalizeProxyPass(proxyTarget);
  const configs = await getWebsiteProxyConfigs(client, websiteId);
  const rootConfig = configs.find((config) => config.name === "root");

  if (normalizeProxyPass(rootConfig?.proxyPass || "") === targetProxyPass) {
    logStep(`proxy config already points to ${targetProxyPass}`);
    return;
  }

  const payload = buildProxyConfigPayload(websiteId, proxyTarget, rootConfig);
  if (dryRun) {
    logStep(`dry-run: would ${payload.operate} website proxy root -> ${payload.proxyPass}`);
    return;
  }

  logStep(`${payload.operate} website proxy root -> ${payload.proxyPass}`);
  await upsertWebsiteProxyConfig(client, payload);
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const envFromFile = await loadEnvFile(options.envFile);

  const baseUrl = normalizeBaseUrl(
    options.baseUrl || process.env.ONEPANEL_BASE_URL || envFromFile.ONEPANEL_BASE_URL || "",
  );
  const apiKey = options.apiKey || process.env.ONEPANEL_API_KEY || envFromFile.ONEPANEL_API_KEY || "";
  const proxyTarget = `${options.proxyHost}:${options.proxyPort}`;

  if (!options.skipLocalDeploy) {
    await assertDirectory(options.webDir, "Web directory");
  }
  if (!options.skipWebsite) {
    if (!baseUrl) {
      throw new Error("Missing ONEPANEL_BASE_URL. Set it in .env or pass --base-url.");
    }
    if (!apiKey) {
      throw new Error("Missing ONEPANEL_API_KEY. Set it in .env or pass --api-key.");
    }
  }

  logStep(`domain=${options.domain}`);
  logStep(`proxyTarget=${proxyTarget}`);
  logStep(`webDir=${options.webDir}`);

  if (!options.skipLocalDeploy) {
    await runLocalDeploy(options.webDir, options.pm2App, options.dryRun);
  }

  if (options.skipWebsite) {
    return;
  }

  const client = new OnePanelClient(baseUrl, apiKey);
  await ensureOpenRestyInstalled(client);
  const groupId = await getDefaultWebsiteGroupId(client);

  const resolution = await ensureWebsiteForDeploy({
    domain: options.domain,
    groupId,
    dryRun: options.dryRun,
    search: () => searchWebsite(client, options.domain),
    create: () => createProxyWebsite(client, options.domain, groupId, proxyTarget),
  });

  if (!resolution.website && resolution.willCreate) {
    logStep(`dry-run: would create proxy website ${options.domain} -> ${proxyTarget} in group ${groupId}`);
    return;
  }

  if (!resolution.website) {
    throw new Error(`Website ${options.domain} was not found after create/search.`);
  }

  if (!resolution.willCreate) {
    logStep(`reusing website #${resolution.website.id} ${resolution.website.primaryDomain || resolution.website.alias || options.domain}`);
  } else {
    logStep(`created website #${resolution.website.id} ${resolution.website.primaryDomain || resolution.website.alias || options.domain}`);
  }

  const detail = await getWebsiteDetail(client, resolution.website.id);
  if (detail.type && detail.type !== "proxy") {
    throw new Error(
      `Website ${options.domain} already exists but type is "${detail.type}", not "proxy". Please convert it manually or remove it first.`,
    );
  }

  await ensureWebsiteProxy(client, detail.id, proxyTarget, options.dryRun);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[deploy:1panel] ${message}`);
    process.exit(1);
  });
}
