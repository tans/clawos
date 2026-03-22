import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

type Mode = "tcp" | "http";
type JsonObject = Record<string, unknown>;

type StartOptions = {
  mode: Mode;
  weixinPath: string;
  injectPath: string;
  dllPath: string;
  tcpIp: string;
  tcpPort: number;
  tcpListenHost: string;
  httpServerPort: number;
  httpCallbackUrl: string;
  useDefault: boolean;
  startServerWhileLogin: boolean;
  captureDir: string;
  apiDocPath: string;
  mcpHost: string;
  mcpPort: number;
  upstreamBase: string;
  autoInject: boolean;
};

type CaptureSummary = {
  totalMessages: number;
  jsonMessages: number;
  rawMessages: number;
  paths: Record<string, string[]>;
  signatures: string[];
};

type ApiItem = {
  method: string;
  name: string;
  category: string;
  urlRaw: string;
  path: string | null;
  host: string | null;
  isCallback: boolean;
  requestExample: unknown | null;
};

type ApiCatalog = {
  items: ApiItem[];
  byMethodPath: Map<string, ApiItem>;
  byPath: Map<string, ApiItem[]>;
};

function parseBool(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseArgs(argv: string[]): StartOptions {
  const options: StartOptions = {
    mode: "http",
    weixinPath: "",
    injectPath: "",
    dllPath: "",
    tcpIp: "127.0.0.1",
    tcpPort: 61108,
    tcpListenHost: "0.0.0.0",
    httpServerPort: 19088,
    httpCallbackUrl: "http://127.0.0.1:5000/api/recvMsg",
    useDefault: false,
    startServerWhileLogin: true,
    captureDir: "",
    apiDocPath: "",
    mcpHost: "127.0.0.1",
    mcpPort: 5000,
    upstreamBase: "http://127.0.0.1:19088",
    autoInject: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--")) {
      continue;
    }
    if (value === undefined) {
      throw new Error(`Missing value for argument ${key}`);
    }

    switch (key) {
      case "--mode":
        if (value !== "tcp" && value !== "http") {
          throw new Error(`Invalid --mode value: ${value}`);
        }
        options.mode = value;
        i += 1;
        break;
      case "--weixin-path":
        options.weixinPath = value;
        i += 1;
        break;
      case "--inject-path":
        options.injectPath = value;
        i += 1;
        break;
      case "--dll-path":
        options.dllPath = value;
        i += 1;
        break;
      case "--tcp-ip":
        options.tcpIp = value;
        i += 1;
        break;
      case "--tcp-port":
        options.tcpPort = Number(value);
        i += 1;
        break;
      case "--tcp-listen-host":
        options.tcpListenHost = value;
        i += 1;
        break;
      case "--http-server-port":
        options.httpServerPort = Number(value);
        i += 1;
        break;
      case "--http-callback-url":
        options.httpCallbackUrl = value;
        i += 1;
        break;
      case "--use-default":
        options.useDefault = parseBool(value);
        i += 1;
        break;
      case "--start-server-while-login":
        options.startServerWhileLogin = parseBool(value);
        i += 1;
        break;
      case "--capture-dir":
        options.captureDir = value;
        i += 1;
        break;
      case "--api-doc":
        options.apiDocPath = value;
        i += 1;
        break;
      case "--mcp-host":
        options.mcpHost = value;
        i += 1;
        break;
      case "--mcp-port":
        options.mcpPort = Number(value);
        i += 1;
        break;
      case "--upstream-base":
        options.upstreamBase = value;
        i += 1;
        break;
      case "--auto-inject":
        options.autoInject = parseBool(value);
        i += 1;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(options.tcpPort) || options.tcpPort <= 0) {
    throw new Error(`Invalid --tcp-port: ${String(options.tcpPort)}`);
  }
  if (!Number.isFinite(options.httpServerPort) || options.httpServerPort <= 0) {
    throw new Error(`Invalid --http-server-port: ${String(options.httpServerPort)}`);
  }
  if (!Number.isFinite(options.mcpPort) || options.mcpPort <= 0) {
    throw new Error(`Invalid --mcp-port: ${String(options.mcpPort)}`);
  }
  return options;
}

function resolveFirstExisting(candidates: string[]): string | null {
  for (const item of candidates) {
    if (!item || !item.trim()) {
      continue;
    }
    const abs = path.isAbsolute(item) ? item : path.resolve(item);
    if (existsSync(abs)) {
      return abs;
    }
  }
  return null;
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; value: null } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function collectPathTypes(value: unknown, prefix: string, out: Map<string, Set<string>>): void {
  const type = valueType(value);
  const key = prefix || "$";
  if (!out.has(key)) {
    out.set(key, new Set());
  }
  out.get(key)?.add(type);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathTypes(item, `${key}[]`, out);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as JsonObject)) {
      const next = key === "$" ? k : `${key}.${k}`;
      collectPathTypes(v, next, out);
    }
  }
}

function buildSignature(pathTypes: Map<string, Set<string>>): string {
  const lines = Array.from(pathTypes.entries())
    .map(([k, v]) => `${k}:${Array.from(v).sort().join("|")}`)
    .sort();
  return lines.join(";");
}

class CaptureStore {
  private readonly dir: string;
  private readonly jsonlPath: string;
  private readonly summaryPath: string;
  private readonly latestPath: string;

  constructor(dir: string) {
    this.dir = dir;
    this.jsonlPath = path.join(this.dir, "messages.jsonl");
    this.summaryPath = path.join(this.dir, "summary.json");
    this.latestPath = path.join(this.dir, "latest.json");
    mkdirSync(this.dir, { recursive: true });
  }

  latestPathname(): string {
    return this.latestPath;
  }

  summaryPathname(): string {
    return this.summaryPath;
  }

  jsonlPathname(): string {
    return this.jsonlPath;
  }

  readLatest(): unknown | null {
    if (!existsSync(this.latestPath)) return null;
    return safeJsonParse(readFileSync(this.latestPath, "utf8")).value;
  }

  readSummaryRaw(): unknown | null {
    if (!existsSync(this.summaryPath)) return null;
    return safeJsonParse(readFileSync(this.summaryPath, "utf8")).value;
  }

  private readSummary(): CaptureSummary {
    const empty: CaptureSummary = {
      totalMessages: 0,
      jsonMessages: 0,
      rawMessages: 0,
      paths: {},
      signatures: [],
    };

    if (!existsSync(this.summaryPath)) {
      return empty;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.summaryPath, "utf8")) as CaptureSummary & {
        signatures?: unknown;
        paths?: unknown;
      };

      const next: CaptureSummary = {
        totalMessages: Number(parsed.totalMessages || 0),
        jsonMessages: Number(parsed.jsonMessages || 0),
        rawMessages: Number(parsed.rawMessages || 0),
        paths: {},
        signatures: [],
      };

      if (parsed.paths && typeof parsed.paths === "object") {
        for (const [k, v] of Object.entries(parsed.paths as Record<string, unknown>)) {
          if (Array.isArray(v)) {
            next.paths[k] = Array.from(
              new Set(v.map((item) => String(item).trim()).filter(Boolean))
            ).sort();
            continue;
          }
          if (v && typeof v === "object") {
            next.paths[k] = Object.keys(v as Record<string, unknown>).sort();
          }
        }
      }

      if (Array.isArray(parsed.signatures)) {
        next.signatures = Array.from(
          new Set(parsed.signatures.map((item) => String(item).trim()).filter(Boolean))
        ).sort();
      } else if (parsed.signatures && typeof parsed.signatures === "object") {
        next.signatures = Object.keys(parsed.signatures as Record<string, unknown>).sort();
      }

      return next;
    } catch {
      return empty;
    }
  }

  save(transport: Mode, payloadText: string, parsed: { ok: true; value: unknown } | { ok: false; value: null }): void {
    const timestamp = new Date().toISOString();
    const event = {
      timestamp,
      transport,
      payloadType: parsed.ok ? "json" : "raw",
      payload: parsed.ok ? parsed.value : payloadText,
      raw: payloadText,
    };

    appendFileSync(this.jsonlPath, `${JSON.stringify(event)}\n`, "utf8");
    writeFileSync(this.latestPath, JSON.stringify(event, null, 2), "utf8");

    const summary = this.readSummary();
    summary.totalMessages += 1;
    if (parsed.ok) {
      summary.jsonMessages += 1;
      const pathTypes = new Map<string, Set<string>>();
      collectPathTypes(parsed.value, "$", pathTypes);

      for (const [pathKey, typeSet] of pathTypes.entries()) {
        const merged = new Set<string>(summary.paths[pathKey] || []);
        for (const t of typeSet) merged.add(t);
        summary.paths[pathKey] = Array.from(merged).sort();
      }

      const signature = buildSignature(pathTypes);
      if (!summary.signatures.includes(signature)) {
        summary.signatures.push(signature);
        summary.signatures.sort();
      }
    } else {
      summary.rawMessages += 1;
    }

    writeFileSync(this.summaryPath, JSON.stringify(summary, null, 2), "utf8");
  }
}

function normalizeMethod(method: string): string {
  return method.trim().toUpperCase();
}

function parseApiDoc(docText: string): ApiCatalog {
  const sections = docText.split(/\r?\n/);
  const items: ApiItem[] = [];

  let inIndex = false;
  let category = "uncategorized";

  const requestExampleMap = new Map<string, unknown | null>();

  const detailBlocks = docText.split(/\r?\n###\s+/g).slice(1);
  for (const block of detailBlocks) {
    const titleMatch = block.match(/^([^\r\n]+)/);
    const methodMatch = block.match(/-\s*Method:\s*`([^`]+)`/i);
    const urlMatch = block.match(/-\s*URL:\s*`([^`]+)`/i);
    if (!titleMatch || !methodMatch || !urlMatch) {
      continue;
    }

    const method = normalizeMethod(methodMatch[1]);
    const urlRaw = urlMatch[1].trim();
    if (urlRaw.toUpperCase() === "N/A") {
      continue;
    }

    let requestExample: unknown | null = null;
    const requestBlockMatch = block.match(/request example:\s*[\r\n]+```json\s*([\s\S]*?)```/i);
    if (requestBlockMatch) {
      const parsed = safeJsonParse(requestBlockMatch[1].trim());
      requestExample = parsed.ok ? parsed.value : requestBlockMatch[1].trim();
    }

    try {
      const parsedUrl = new URL(urlRaw);
      const key = `${method} ${parsedUrl.pathname}`;
      requestExampleMap.set(key, requestExample);
    } catch {
      // ignore invalid URL in details
    }
  }

  for (const rawLine of sections) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      inIndex = /^##\s+Index\b/i.test(line);
      continue;
    }

    if (!inIndex) {
      continue;
    }

    if (line.startsWith("### ")) {
      category = line.replace(/^###\s+/, "").trim();
      continue;
    }

    const m = line.match(
      /^-\s*`([^`]+)`\s+(.+?)\s+-\s+(?:`([^`]+)`|(N\/A))\s*$/i
    );
    if (!m) {
      continue;
    }

    const method = normalizeMethod(m[1]);
    const name = m[2].trim();
    const urlRaw = (m[3] || m[4] || "").trim();

    let pathValue: string | null = null;
    let hostValue: string | null = null;
    let isCallback = false;

    if (urlRaw.toUpperCase() === "N/A") {
      isCallback = true;
    } else {
      try {
        const parsed = new URL(urlRaw);
        pathValue = parsed.pathname;
        hostValue = parsed.origin;
      } catch {
        isCallback = true;
      }
    }

    const requestExample = pathValue
      ? requestExampleMap.get(`${method} ${pathValue}`) ?? null
      : null;

    items.push({
      method,
      name,
      category,
      urlRaw,
      path: pathValue,
      host: hostValue,
      isCallback,
      requestExample,
    });
  }

  const byMethodPath = new Map<string, ApiItem>();
  const byPath = new Map<string, ApiItem[]>();

  for (const item of items) {
    if (!item.path) {
      continue;
    }
    byMethodPath.set(`${item.method} ${item.path}`, item);
    const list = byPath.get(item.path) || [];
    list.push(item);
    byPath.set(item.path, list);
  }

  return { items, byMethodPath, byPath };
}

function logReceived(prefix: string, payload: string): void {
  const ts = new Date().toISOString();
  console.log("=".repeat(72));
  console.log(`[${ts}] ${prefix}`);
  const parsed = safeJsonParse(payload);
  if (parsed.ok) {
    console.log(JSON.stringify(parsed.value, null, 2));
  } else {
    console.log(payload);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function buildTargetUrl(item: ApiItem, reqUrl: URL, upstreamBase: URL): URL | null {
  if (!item.path) {
    return null;
  }

  const target = new URL(item.path, upstreamBase);
  if (item.urlRaw.toUpperCase() !== "N/A") {
    try {
      const src = new URL(item.urlRaw);
      if (src.port) {
        target.port = src.port;
      }
    } catch {
      // keep defaults from upstream
    }
  }
  target.search = reqUrl.search;
  return target;
}

async function proxyRequest(req: Request, target: URL): Promise<Response> {
  const inHeaders = new Headers(req.headers);
  inHeaders.delete("host");

  const body = ["GET", "HEAD"].includes(req.method.toUpperCase()) ? undefined : await req.text();

  const upstreamResp = await fetch(target, {
    method: req.method,
    headers: inHeaders,
    body,
  });

  const outHeaders = new Headers(upstreamResp.headers);
  outHeaders.delete("content-encoding");

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: outHeaders,
  });
}

function parseCallbackPathFromUrl(callbackUrl: string): string {
  try {
    const u = new URL(callbackUrl);
    return u.pathname || "/api/recvMsg";
  } catch {
    return "/api/recvMsg";
  }
}

async function startTcpPrinter(
  listenHost: string,
  listenPort: number,
  onMessage: (payload: string) => void
): Promise<{ close: () => Promise<void> }> {
  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress || "unknown"}:${socket.remotePort || 0}`;
    console.log(`[tcp] client connected: ${remote}`);
    let buffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const lenBE = buffer.readUInt32BE(0);
        const lenLE = buffer.readUInt32LE(0);
        const max = 1024 * 1024;
        const length = lenBE > 0 && lenBE <= max ? lenBE : lenLE > 0 && lenLE <= max ? lenLE : -1;
        if (length <= 0) {
          console.error("[tcp] invalid frame length, closing socket");
          socket.destroy();
          return;
        }
        if (buffer.length < 4 + length) {
          break;
        }

        const payload = buffer.subarray(4, 4 + length).toString("utf8");
        logReceived(`WeChat TCP message from ${remote}`, payload);
        onMessage(payload);
        buffer = buffer.subarray(4 + length);
      }
    });

    socket.on("close", () => console.log(`[tcp] client disconnected: ${remote}`));
    socket.on("error", (error) => console.error(`[tcp] client error ${remote}:`, error.message));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, listenHost, () => resolve());
  });

  console.log(`TCP message printer listening on ${listenHost}:${listenPort}`);
  return {
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function runInject(options: StartOptions, scriptRoot: string): Promise<void> {
  const injectPath =
    resolveFirstExisting([
      options.injectPath,
      path.join(scriptRoot, "inject.exe"),
      path.join(scriptRoot, "x64 inject.exe"),
    ]) || "";
  if (!injectPath) {
    throw new Error(`inject.exe not found in ${scriptRoot}`);
  }

  const dllPath =
    resolveFirstExisting([
      options.dllPath,
      path.join(scriptRoot, "libGLESv1.dll"),
    ]) || "";
  if (!dllPath) {
    throw new Error(`libGLESv1.dll not found in ${scriptRoot}`);
  }

  const weixinPath =
    resolveFirstExisting([
      options.weixinPath,
      "C:\\Program Files\\Tencent\\Weixin\\Weixin.exe",
      "C:\\Program Files (x86)\\Tencent\\Weixin\\Weixin.exe",
      "D:\\Program Files\\Tencent\\Weixin\\Weixin.exe",
      "D:\\Program Files (x86)\\Tencent\\Weixin\\Weixin.exe",
    ]) || "";
  if (!weixinPath) {
    throw new Error("Weixin.exe not found. Use --weixin-path to specify exact path.");
  }

  const config = {
    recivemode: options.mode,
    tcp_ip: options.tcpIp,
    tcp_port: options.tcpPort,
    http_server_port: options.httpServerPort,
    http_callback_url: options.httpCallbackUrl,
    usedefault: options.useDefault,
    start_server_while_login: options.startServerWhileLogin,
  };

  console.log("Inject:", injectPath);
  console.log("Weixin:", weixinPath);
  console.log("DLL:", dllPath);
  console.log("Mode:", options.mode);
  console.log("Config:", JSON.stringify(config));

  const proc = Bun.spawn([injectPath, weixinPath, dllPath, JSON.stringify(config)], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`inject.exe failed with exit code ${code}`);
  }
  console.log("wechat-mcp injected successfully.");
}

async function main(): Promise<void> {
  const options = parseArgs(Bun.argv.slice(2));
  const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
  const captureDir = options.captureDir.trim()
    ? (path.isAbsolute(options.captureDir) ? options.captureDir : path.resolve(options.captureDir))
    : path.join(scriptRoot, "captures");
  const captures = new CaptureStore(captureDir);

  const docPath = resolveFirstExisting([
    options.apiDocPath,
    path.join(scriptRoot, "api.md"),
  ]);
  if (!docPath) {
    throw new Error("api.md not found. Use --api-doc to specify exact path.");
  }

  const catalog = parseApiDoc(readFileSync(docPath, "utf8"));
  const callbackPath = parseCallbackPathFromUrl(options.httpCallbackUrl);
  const upstreamBase = new URL(options.upstreamBase);

  console.log(`Capture directory: ${captureDir}`);
  console.log(`API doc: ${docPath}`);
  console.log(`Catalog loaded: ${catalog.items.length} items`);

  const onMessage = (payload: string) => {
    captures.save(options.mode, payload, safeJsonParse(payload));
  };

  const mcpServer = Bun.serve({
    hostname: options.mcpHost,
    port: options.mcpPort,
    fetch: async (req) => {
      const reqUrl = new URL(req.url);
      const method = normalizeMethod(req.method);
      const pathname = reqUrl.pathname;

      if (pathname === callbackPath && ["POST", "PUT"].includes(method)) {
        const body = await req.text();
        logReceived(`WeChat HTTP callback ${method} ${pathname}`, body);
        onMessage(body);
        return jsonResponse({ ok: true, source: "callback", path: pathname });
      }

      if (pathname === "/health") {
        return jsonResponse({ ok: true, service: "wechat-mcp", mode: options.mode });
      }

      if (pathname === "/api/_meta/apis") {
        return jsonResponse({
          ok: true,
          total: catalog.items.length,
          list: catalog.items,
        });
      }

      if (pathname === "/api/_meta/stats") {
        const callbackCount = catalog.items.filter((x) => x.isCallback).length;
        const callableCount = catalog.items.length - callbackCount;
        return jsonResponse({
          ok: true,
          total: catalog.items.length,
          callable: callableCount,
          callbacks: callbackCount,
          callbackPath,
          mode: options.mode,
        });
      }

      if (pathname === "/api/_capture/latest") {
        return jsonResponse({ ok: true, data: captures.readLatest() });
      }

      if (pathname === "/api/_capture/summary") {
        return jsonResponse({ ok: true, data: captures.readSummaryRaw() });
      }

      const exact = catalog.byMethodPath.get(`${method} ${pathname}`);
      if (!exact) {
        return jsonResponse(
          {
            ok: false,
            error: "api not found in api.md index",
            method,
            path: pathname,
          },
          404
        );
      }

      if (exact.isCallback || !exact.path) {
        return jsonResponse(
          {
            ok: false,
            error: "callback api cannot be actively called",
            api: exact,
          },
          400
        );
      }

      const target = buildTargetUrl(exact, reqUrl, upstreamBase);
      if (!target) {
        return jsonResponse({ ok: false, error: "failed to resolve upstream target" }, 500);
      }

      try {
        const resp = await proxyRequest(req, target);
        return resp;
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            upstream: target.toString(),
          },
          502
        );
      }
    },
  });

  console.log(`wechat-mcp server listening on http://${options.mcpHost}:${options.mcpPort}`);
  console.log(`callback endpoint: ${callbackPath}`);

  const closers: Array<() => Promise<void>> = [
    async () => {
      mcpServer.stop(true);
    },
  ];

  if (options.mode === "tcp") {
    const tcpPrinter = await startTcpPrinter(options.tcpListenHost, options.tcpPort, onMessage);
    closers.push(tcpPrinter.close);
    if (
      options.tcpIp !== "127.0.0.1" &&
      options.tcpIp !== "0.0.0.0" &&
      options.tcpIp !== options.tcpListenHost
    ) {
      console.warn(
        `[warn] tcp_ip is ${options.tcpIp}, but local tcp listener is ${options.tcpListenHost}:${options.tcpPort}. Ensure they can route.`
      );
    }
  }

  if (options.autoInject) {
    await runInject(options, scriptRoot);
  } else {
    console.log("Skip inject because --auto-inject false");
  }

  console.log("Ready. Press Ctrl+C to exit.");
  console.log(`Saved files:`);
  console.log(`- ${captures.jsonlPathname()}`);
  console.log(`- ${captures.summaryPathname()}`);
  console.log(`- ${captures.latestPathname()}`);

  const shutdown = async () => {
    for (const close of closers) {
      try {
        await close();
      } catch {
        // ignore close errors
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    void shutdown();
  });
  process.on("SIGTERM", () => {
    console.log("\nShutting down...");
    void shutdown();
  });

  await new Promise<void>(() => {
    // keep process alive
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
