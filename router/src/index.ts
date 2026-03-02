import {
  BillingError,
  ROUTER_DB_PATH,
  canServeRequest,
  chargeUsage,
  getUsageSummary,
  getAccount,
  initializeBilling,
  rechargeAccount,
  renewPlan,
  resolveAccountByToken,
} from "./billing";

type ProviderName = "openai" | "deepseek" | "anthropic";

type Candidate = {
  provider: ProviderName;
  model: string;
};

type ProviderConfig = {
  name: ProviderName;
  baseUrl: string;
  keys: string[];
  keyIndex: number;
};

type ChatMessage = {
  role: string;
  content: unknown;
  name?: string;
};

type ChatCompletionRequest = {
  model?: string;
  stream?: boolean;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  [key: string]: unknown;
};

type OpenAIStylePayload = Record<string, unknown>;

type NonStreamCallResult = {
  payload: OpenAIStylePayload;
  resolvedModel: string;
  requestId: string;
};

type StreamCallResult = {
  response: Response;
  resolvedModel: string;
  requestId: string;
};

type AuthContext = {
  accountId: string;
  keyId: string | null;
  token: string | null;
};

class UpstreamError extends Error {
  readonly provider: ProviderName;
  readonly status: number;
  readonly detail: string;

  constructor(provider: ProviderName, status: number, detail: string) {
    super(`${provider} upstream error ${status}`);
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

const PORT = Number(process.env.ROUTER_PORT || "8788");
const DEFAULT_ACCOUNT_ID = (process.env.ROUTER_DEFAULT_ACCOUNT_ID || "acct_demo").trim();
const DEFAULT_ACCOUNT_NAME = (process.env.ROUTER_DEFAULT_ACCOUNT_NAME || "Demo Account").trim();
const DEFAULT_CURRENCY = (process.env.ROUTER_CURRENCY || "CNY").trim().toUpperCase();

const ROUTER_API_KEYS = parseCsv(process.env.ROUTER_API_KEYS || "");
const SEEDED_API_KEYS = parseSeedApiKeys(process.env.ROUTER_SEED_KEYS || "", DEFAULT_ACCOUNT_ID, ROUTER_API_KEYS);
const REQUIRE_AUTH = process.env.ROUTER_REQUIRE_AUTH === "1" || SEEDED_API_KEYS.length > 0;

const PRICE_INPUT_PER_1M_CENTS = Number(process.env.ROUTER_PRICE_INPUT_PER_1M_CENTS || "200");
const PRICE_OUTPUT_PER_1M_CENTS = Number(process.env.ROUTER_PRICE_OUTPUT_PER_1M_CENTS || "800");
const STREAM_FLAT_CENTS = Math.max(0, Math.floor(Number(process.env.ROUTER_STREAM_FLAT_CENTS || "1")));

const PLAN_CATALOG: Record<string, { name: string; monthlyPriceCents: number }> = {
  "basic-monthly": {
    name: "Basic Monthly",
    monthlyPriceCents: Number(process.env.ROUTER_PLAN_BASIC_MONTHLY_CENTS || "3900"),
  },
  "pro-monthly": {
    name: "Pro Monthly",
    monthlyPriceCents: Number(process.env.ROUTER_PLAN_PRO_MONTHLY_CENTS || "9900"),
  },
};

initializeBilling({
  defaultAccountId: DEFAULT_ACCOUNT_ID,
  defaultAccountName: DEFAULT_ACCOUNT_NAME,
  defaultCurrency: DEFAULT_CURRENCY,
  seedApiKeys: SEEDED_API_KEYS,
});

const providers: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: "openai",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, ""),
    keys: readProviderKeys("OPENAI"),
    keyIndex: 0,
  },
  deepseek: {
    name: "deepseek",
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
    keys: readProviderKeys("DEEPSEEK"),
    keyIndex: 0,
  },
  anthropic: {
    name: "anthropic",
    baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
    keys: readProviderKeys("ANTHROPIC"),
    keyIndex: 0,
  },
};

const ALIASES: Record<string, Candidate[]> = {
  auto: [
    { provider: "deepseek", model: process.env.ROUTER_MODEL_AUTO_DEEPSEEK || "deepseek-chat" },
    { provider: "openai", model: process.env.ROUTER_MODEL_AUTO_OPENAI || "gpt-4.1-mini" },
    { provider: "anthropic", model: process.env.ROUTER_MODEL_AUTO_ANTHROPIC || "claude-3-5-haiku-latest" },
  ],
  "auto-fast": [
    { provider: "deepseek", model: process.env.ROUTER_MODEL_FAST_DEEPSEEK || "deepseek-chat" },
    { provider: "openai", model: process.env.ROUTER_MODEL_FAST_OPENAI || "gpt-4.1-mini" },
  ],
  "auto-code": [
    { provider: "deepseek", model: process.env.ROUTER_MODEL_CODE_DEEPSEEK || "deepseek-chat" },
    { provider: "openai", model: process.env.ROUTER_MODEL_CODE_OPENAI || "gpt-4.1" },
    { provider: "anthropic", model: process.env.ROUTER_MODEL_CODE_ANTHROPIC || "claude-3-5-sonnet-latest" },
  ],
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return withCors(
        json(
          {
            ok: true,
            service: "clawos-router",
            version: "0.2.0",
            ts: Date.now(),
            dbPath: ROUTER_DB_PATH,
            authRequired: REQUIRE_AUTH,
            providers: {
              openai: providers.openai.keys.length > 0,
              deepseek: providers.deepseek.keys.length > 0,
              anthropic: providers.anthropic.keys.length > 0,
            },
          },
          200,
        ),
      );
    }

    if (url.pathname === "/v1/models" && req.method === "GET") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      return withCors(
        json(
          {
            object: "list",
            data: buildModelList(),
          },
          200,
        ),
      );
    }

    if (url.pathname === "/router/v1/account/balance" && req.method === "GET") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      const account = getAccount(auth.accountId);
      if (!account) {
        return withCors(errorResponse(404, "ACCOUNT_NOT_FOUND", "账户不存在。", "billing_error", req));
      }

      return withCors(
        json(
          {
            ok: true,
            accountId: account.id,
            currency: account.currency,
            balance: toMoney(account.balanceCents),
            balanceCents: account.balanceCents,
            plan: {
              code: account.planCode,
              active: Boolean(account.planExpiresAt && account.planExpiresAt > Date.now()),
              expiresAt: account.planExpiresAt,
            },
            updatedAt: account.updatedAt,
          },
          200,
        ),
      );
    }

    if (url.pathname === "/router/v1/billing/usage" && req.method === "GET") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      const accountId = readAccountId(url.searchParams.get("accountId"), auth.accountId);
      if (!accountId) {
        return withCors(errorResponse(400, "INVALID_ACCOUNT_ID", "accountId 不合法。", "invalid_request_error", req));
      }
      if (accountId !== auth.accountId) {
        return withCors(errorResponse(403, "FORBIDDEN", "只能查询当前 API key 对应账户。", "auth_error", req));
      }

      const period = resolveUsagePeriod(url.searchParams.get("from"), url.searchParams.get("to"));
      if (!period) {
        return withCors(
          errorResponse(
            400,
            "INVALID_DATE_RANGE",
            "from/to 必须是 YYYY-MM-DD，且 from <= to，范围不超过 366 天。",
            "invalid_request_error",
            req,
          ),
        );
      }

      const modelLimit = Math.max(1, Math.min(50, parsePositiveInt(url.searchParams.get("modelLimit"), 20)));

      try {
        const usage = getUsageSummary({
          accountId,
          fromMs: period.fromMs,
          toMs: period.toMs,
          modelLimit,
        });

        return withCors(
          json(
            {
              ok: true,
              accountId,
              period: {
                from: period.from,
                to: period.to,
                fromMs: period.fromMs,
                toMs: period.toMs,
              },
              summary: {
                requests: usage.requests,
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                costCents: usage.costCents,
                chargedCents: usage.chargedCents,
                costAmount: toMoney(usage.costCents),
                chargedAmount: toMoney(usage.chargedCents),
                currency: usage.currency,
              },
              byModel: usage.byModel.map((row) => ({
                modelAlias: row.modelAlias,
                resolvedModel: row.resolvedModel,
                requests: row.requests,
                promptTokens: row.promptTokens,
                completionTokens: row.completionTokens,
                totalTokens: row.totalTokens,
                costCents: row.costCents,
                chargedCents: row.chargedCents,
                costAmount: toMoney(row.costCents),
                chargedAmount: toMoney(row.chargedCents),
              })),
            },
            200,
          ),
        );
      } catch (error) {
        if (error instanceof BillingError) {
          return withCors(errorResponse(error.status, error.code, error.message, "billing_error", req));
        }
        return withCors(errorResponse(500, "INTERNAL_ERROR", toErrorMessage(error), "internal_error", req));
      }
    }

    if (url.pathname === "/router/v1/billing/recharge" && req.method === "POST") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      const body = await parseJsonBody(req);
      if (!body) {
        return withCors(errorResponse(400, "INVALID_REQUEST", "请求体必须是 JSON。", "invalid_request_error", req));
      }

      const accountId = readAccountId(body.accountId, auth.accountId);
      if (!accountId) {
        return withCors(errorResponse(400, "INVALID_ACCOUNT_ID", "accountId 不合法。", "invalid_request_error", req));
      }
      if (accountId !== auth.accountId) {
        return withCors(errorResponse(403, "FORBIDDEN", "只能操作当前 API key 对应账户。", "auth_error", req));
      }

      const amountCents = parseAmountToCents(body.amount);
      const channel = readShortText(body.channel, 32) || "unknown";
      const outTradeNo = readShortText(body.outTradeNo, 128);

      if (amountCents === null || amountCents <= 0) {
        return withCors(errorResponse(400, "INVALID_AMOUNT", "amount 必须大于 0。", "invalid_request_error", req));
      }
      if (!outTradeNo) {
        return withCors(errorResponse(400, "INVALID_OUT_TRADE_NO", "outTradeNo 不能为空。", "invalid_request_error", req));
      }

      try {
        const result = rechargeAccount({
          accountId,
          amountCents,
          currency: DEFAULT_CURRENCY,
          channel,
          outTradeNo,
        });

        return withCors(
          json(
            {
              ok: true,
              orderId: result.orderId,
              accountId: result.accountId,
              amount: toMoney(result.amountCents),
              amountCents: result.amountCents,
              currency: result.currency,
              balance: toMoney(result.balanceCents),
              balanceCents: result.balanceCents,
              idempotent: result.idempotent,
              createdAt: result.createdAt,
            },
            200,
          ),
        );
      } catch (error) {
        if (error instanceof BillingError) {
          return withCors(errorResponse(error.status, error.code, error.message, "billing_error", req));
        }
        return withCors(errorResponse(500, "INTERNAL_ERROR", toErrorMessage(error), "internal_error", req));
      }
    }

    if (url.pathname === "/router/v1/billing/renew" && req.method === "POST") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      const body = await parseJsonBody(req);
      if (!body) {
        return withCors(errorResponse(400, "INVALID_REQUEST", "请求体必须是 JSON。", "invalid_request_error", req));
      }

      const accountId = readAccountId(body.accountId, auth.accountId);
      if (!accountId) {
        return withCors(errorResponse(400, "INVALID_ACCOUNT_ID", "accountId 不合法。", "invalid_request_error", req));
      }
      if (accountId !== auth.accountId) {
        return withCors(errorResponse(403, "FORBIDDEN", "只能操作当前 API key 对应账户。", "auth_error", req));
      }

      const planCode = readShortText(body.planCode, 64);
      const months = parsePositiveInt(body.months, 1);
      const channel = readShortText(body.channel, 32) || "unknown";
      const outTradeNo = readShortText(body.outTradeNo, 128);

      if (!planCode || !PLAN_CATALOG[planCode]) {
        return withCors(errorResponse(400, "INVALID_PLAN", "planCode 不合法。", "invalid_request_error", req));
      }
      if (!outTradeNo) {
        return withCors(errorResponse(400, "INVALID_OUT_TRADE_NO", "outTradeNo 不能为空。", "invalid_request_error", req));
      }

      const plan = PLAN_CATALOG[planCode];
      const amountCents = parseAmountToCents(body.amount) ?? plan.monthlyPriceCents * months;

      try {
        const result = renewPlan({
          accountId,
          planCode,
          months,
          amountCents,
          currency: DEFAULT_CURRENCY,
          channel,
          outTradeNo,
        });

        return withCors(
          json(
            {
              ok: true,
              orderId: result.orderId,
              accountId: result.accountId,
              plan: {
                code: result.planCode,
                months: result.months,
                expiresAt: result.expiresAt,
              },
              amount: toMoney(result.amountCents),
              amountCents: result.amountCents,
              currency: result.currency,
              idempotent: result.idempotent,
              createdAt: result.createdAt,
            },
            200,
          ),
        );
      } catch (error) {
        if (error instanceof BillingError) {
          return withCors(errorResponse(error.status, error.code, error.message, "billing_error", req));
        }
        return withCors(errorResponse(500, "INTERNAL_ERROR", toErrorMessage(error), "internal_error", req));
      }
    }

    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const auth = requireAuth(req);
      if (!auth) {
        return withCors(authError(req));
      }

      const body = await parseJsonBody(req);
      if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
        return withCors(
          errorResponse(400, "INVALID_REQUEST", "messages 不能为空，且必须是数组。", "invalid_request_error", req),
        );
      }

      const account = getAccount(auth.accountId);
      if (!account) {
        return withCors(errorResponse(404, "ACCOUNT_NOT_FOUND", "账户不存在。", "billing_error", req));
      }

      if (account.status !== "active") {
        return withCors(errorResponse(403, "ACCOUNT_DISABLED", "账户不可用。", "billing_error", req));
      }

      const request = body as ChatCompletionRequest;
      const stream = request.stream === true;
      const preflight = canServeRequest(account, stream ? STREAM_FLAT_CENTS : 0);
      if (!preflight.ok) {
        return withCors(errorResponse(402, "INSUFFICIENT_BALANCE", "余额不足，请充值或续费。", "billing_error", req));
      }

      const requestedModel = typeof request.model === "string" && request.model.trim() ? request.model.trim() : "auto";
      const candidates = resolveCandidates(requestedModel, stream);
      if (candidates.length === 0) {
        return withCors(
          errorResponse(503, "NO_PROVIDER_AVAILABLE", "未配置可用的上游 provider key。", "upstream_error", req),
        );
      }

      const errors: Array<{ provider: string; status: number; detail: string }> = [];

      for (const candidate of candidates) {
        try {
          if (stream) {
            if (candidate.provider === "anthropic") {
              continue;
            }

            const streamResult = await callOpenAICompatibleStream(candidate, request, req);

            const charge = chargeUsage({
              accountId: auth.accountId,
              requestId: streamResult.requestId,
              modelAlias: requestedModel,
              resolvedModel: streamResult.resolvedModel,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              costCents: STREAM_FLAT_CENTS,
              currency: DEFAULT_CURRENCY,
            });

            return withCors(attachBillingHeaders(streamResult.response, charge.chargedCents, charge.balanceCents));
          }

          const callResult =
            candidate.provider === "anthropic"
              ? await callAnthropicNonStream(candidate, request, req)
              : await callOpenAICompatibleNonStream(candidate, request, req);

          const usage = extractUsage(callResult.payload);
          const costCents = calculateUsageCostCents(usage.promptTokens, usage.completionTokens);

          const charge = chargeUsage({
            accountId: auth.accountId,
            requestId: callResult.requestId,
            modelAlias: requestedModel,
            resolvedModel: callResult.resolvedModel,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            costCents,
            currency: DEFAULT_CURRENCY,
          });

          const routerInfo = asRecord(callResult.payload.router);
          callResult.payload.router = {
            ...routerInfo,
            resolved_model: callResult.resolvedModel,
            billing: {
              charged_cents: charge.chargedCents,
              charged_amount: toMoney(charge.chargedCents),
              balance_cents: charge.balanceCents,
              balance: toMoney(charge.balanceCents),
              plan_active: charge.planActive,
              plan_expires_at: charge.planExpiresAt,
            },
          };

          return withCors(
            json(callResult.payload, 200, {
              "x-request-id": callResult.requestId,
              "x-router-resolved-model": callResult.resolvedModel,
              "x-router-charged-cents": String(charge.chargedCents),
              "x-router-balance-cents": String(charge.balanceCents),
            }),
          );
        } catch (error) {
          if (error instanceof BillingError) {
            return withCors(errorResponse(error.status, error.code, error.message, "billing_error", req));
          }

          if (error instanceof UpstreamError) {
            errors.push({
              provider: error.provider,
              status: error.status,
              detail: truncate(error.detail, 400),
            });
            continue;
          }

          errors.push({
            provider: candidate.provider,
            status: 500,
            detail: toErrorMessage(error),
          });
        }
      }

      return withCors(
        json(
          {
            error: {
              code: "UPSTREAM_ALL_FAILED",
              type: "upstream_error",
              message: "所有上游 provider 调用失败。",
              request_id: requestIdFrom(req),
              providers: errors,
            },
          },
          503,
        ),
      );
    }

    return withCors(
      errorResponse(404, "NOT_FOUND", "route not found", "invalid_request_error", req),
    );
  },
});

console.log(`[router] listening on http://127.0.0.1:${server.port}`);
console.log(`[router] db: ${ROUTER_DB_PATH}`);
console.log(`[router] auth required: ${REQUIRE_AUTH} (seeded keys: ${SEEDED_API_KEYS.length})`);
console.log(
  `[router] providers: openai=${providers.openai.keys.length}, deepseek=${providers.deepseek.keys.length}, anthropic=${providers.anthropic.keys.length}`,
);

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseSeedApiKeys(raw: string, defaultAccountId: string, fallbackKeys: string[]): Array<{ accountId: string; token: string }> {
  const out: Array<{ accountId: string; token: string }> = [];

  const chunks = raw
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const item of chunks) {
    const idx = item.indexOf(":");
    if (idx < 1) {
      continue;
    }
    const accountId = item.slice(0, idx).trim();
    const tokens = item
      .slice(idx + 1)
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const token of tokens) {
      out.push({ accountId, token });
    }
  }

  if (out.length === 0) {
    for (const token of fallbackKeys) {
      out.push({ accountId: defaultAccountId, token });
    }
  }

  return out;
}

function requireAuth(req: Request): AuthContext | null {
  const token = readBearer(req);
  if (!token) {
    if (REQUIRE_AUTH) {
      return null;
    }
    return {
      accountId: DEFAULT_ACCOUNT_ID,
      keyId: null,
      token: null,
    };
  }

  const resolved = resolveAccountByToken(token);
  if (!resolved) {
    return null;
  }

  return {
    accountId: resolved.accountId,
    keyId: resolved.keyId,
    token,
  };
}

function readBearer(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return "";
  }
  return auth.slice("Bearer ".length).trim();
}

function readProviderKeys(prefix: "OPENAI" | "DEEPSEEK" | "ANTHROPIC"): string[] {
  const many = parseCsv(process.env[`${prefix}_API_KEYS`] || "");
  if (many.length > 0) {
    return many;
  }
  const single = (process.env[`${prefix}_API_KEY`] || "").trim();
  return single ? [single] : [];
}

function requestIdFrom(req: Request): string {
  const rid = req.headers.get("x-request-id");
  return rid && rid.trim() ? rid.trim() : `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

function authError(req: Request): Response {
  return json(
    {
      error: {
        code: "UNAUTHORIZED",
        type: "auth_error",
        message: "invalid bearer token",
        request_id: requestIdFrom(req),
      },
    },
    401,
  );
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildModelList() {
  const aliasList = [
    { id: "auto", object: "model", owned_by: "clawos-router" },
    { id: "auto-fast", object: "model", owned_by: "clawos-router" },
    { id: "auto-code", object: "model", owned_by: "clawos-router" },
  ];

  const explicit: Array<{ id: string; object: string; owned_by: string }> = [];
  for (const [alias, candidates] of Object.entries(ALIASES)) {
    for (const c of candidates) {
      if (providers[c.provider].keys.length === 0) {
        continue;
      }
      explicit.push({
        id: `${alias}->${c.provider}/${c.model}`,
        object: "model",
        owned_by: "clawos-router",
      });
    }
  }

  return [...aliasList, ...explicit];
}

function resolveCandidates(model: string, stream: boolean): Candidate[] {
  let candidates: Candidate[] = [];

  if (ALIASES[model]) {
    candidates = ALIASES[model];
  } else {
    const exact = parseProviderModel(model);
    if (exact) {
      candidates = [exact];
    } else {
      candidates = ALIASES.auto;
    }
  }

  const dedup = new Set<string>();
  const filtered: Candidate[] = [];

  for (const c of candidates) {
    if (providers[c.provider].keys.length === 0) {
      continue;
    }
    if (stream && c.provider === "anthropic") {
      continue;
    }

    const key = `${c.provider}/${c.model}`;
    if (dedup.has(key)) {
      continue;
    }
    dedup.add(key);
    filtered.push(c);
  }

  return filtered;
}

function parseProviderModel(input: string): Candidate | null {
  const parts = input.split("/");
  if (parts.length < 2) {
    return null;
  }

  const provider = parts[0] as ProviderName;
  if (provider !== "openai" && provider !== "deepseek" && provider !== "anthropic") {
    return null;
  }

  const model = parts.slice(1).join("/").trim();
  if (!model) {
    return null;
  }

  return { provider, model };
}

async function callOpenAICompatibleNonStream(
  candidate: Candidate,
  reqBody: ChatCompletionRequest,
  req: Request,
): Promise<NonStreamCallResult> {
  const provider = providers[candidate.provider];
  const payload = {
    ...reqBody,
    model: candidate.model,
    stream: false,
  };

  const requestId = requestIdFrom(req);
  const resolved = `${candidate.provider}/${candidate.model}`;

  const upstream = await fetchWithKeyRotation(provider, `${provider.baseUrl}/v1/chat/completions`, payload, requestId, {
    "content-type": "application/json",
  });

  const data = (await upstream.json()) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new UpstreamError(candidate.provider, 502, "non-json upstream response");
  }

  const out = data as OpenAIStylePayload;
  const router = asRecord(out.router);
  out.router = {
    ...router,
    resolved_model: resolved,
  };

  return {
    payload: out,
    resolvedModel: resolved,
    requestId,
  };
}

async function callOpenAICompatibleStream(
  candidate: Candidate,
  reqBody: ChatCompletionRequest,
  req: Request,
): Promise<StreamCallResult> {
  const provider = providers[candidate.provider];
  const payload = {
    ...reqBody,
    model: candidate.model,
    stream: true,
  };

  const requestId = requestIdFrom(req);
  const resolved = `${candidate.provider}/${candidate.model}`;

  const upstream = await fetchWithKeyRotation(provider, `${provider.baseUrl}/v1/chat/completions`, payload, requestId, {
    "content-type": "application/json",
  });

  const headers = new Headers(upstream.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-router-resolved-model", resolved);
  if (!headers.get("content-type")) {
    headers.set("content-type", "text/event-stream; charset=utf-8");
  }
  headers.set("cache-control", "no-cache");
  headers.set("connection", "keep-alive");

  return {
    response: new Response(upstream.body, {
      status: 200,
      headers,
    }),
    resolvedModel: resolved,
    requestId,
  };
}

async function callAnthropicNonStream(
  candidate: Candidate,
  reqBody: ChatCompletionRequest,
  req: Request,
): Promise<NonStreamCallResult> {
  const provider = providers.anthropic;
  const payload = convertToAnthropicPayload(reqBody, candidate.model);
  const requestId = requestIdFrom(req);

  const upstream = await fetchWithKeyRotation(provider, `${provider.baseUrl}/v1/messages`, payload, requestId, {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  });

  const raw = (await upstream.json()) as Record<string, unknown>;
  const text = extractAnthropicText(raw.content);
  const usage = asRecord(raw.usage);
  const inputTokens = toNonNegativeInt(usage.input_tokens);
  const outputTokens = toNonNegativeInt(usage.output_tokens);

  return {
    requestId,
    resolvedModel: `${candidate.provider}/${candidate.model}`,
    payload: {
      id: typeof raw.id === "string" ? raw.id : `chatcmpl_${crypto.randomUUID().replaceAll("-", "")}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: reqBody.model || "auto",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: text,
          },
          finish_reason: mapAnthropicStopReason(typeof raw.stop_reason === "string" ? raw.stop_reason : "end_turn"),
        },
      ],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      router: {
        resolved_model: `${candidate.provider}/${candidate.model}`,
      },
    },
  };
}

function convertToAnthropicPayload(reqBody: ChatCompletionRequest, model: string) {
  const messages: ChatMessage[] = Array.isArray(reqBody.messages) ? reqBody.messages : [];
  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => normalizeTextContent(m.content))
    .filter(Boolean);

  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: normalizeTextContent(m.content),
    }));

  return {
    model,
    max_tokens: typeof reqBody.max_tokens === "number" && reqBody.max_tokens > 0 ? reqBody.max_tokens : 1024,
    temperature: reqBody.temperature,
    top_p: reqBody.top_p,
    system: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
    messages: anthropicMessages,
  };
}

function normalizeTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const obj = part as Record<string, unknown>;
          if (obj.type === "text" && typeof obj.text === "string") {
            return obj.text;
          }
        }
        return "";
      })
      .join("\n");
  }

  return String(content ?? "");
}

function extractAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const v = item as Record<string, unknown>;
      return v.type === "text" && typeof v.text === "string" ? v.text : "";
    })
    .join("\n")
    .trim();
}

function mapAnthropicStopReason(reason: string): string {
  if (reason === "max_tokens") {
    return "length";
  }
  if (reason === "tool_use") {
    return "tool_calls";
  }
  return "stop";
}

async function fetchWithKeyRotation(
  provider: ProviderConfig,
  url: string,
  payload: unknown,
  requestId: string,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  if (provider.keys.length === 0) {
    throw new UpstreamError(provider.name, 503, `${provider.name} key not configured`);
  }

  const maxAttempts = Math.min(provider.keys.length, 3);
  let lastErr: UpstreamError | null = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    const key = nextProviderKey(provider);
    const headers = new Headers(extraHeaders);

    if (provider.name === "anthropic") {
      headers.set("x-api-key", key);
    } else {
      headers.set("authorization", `Bearer ${key}`);
    }

    headers.set("x-request-id", requestId);

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (upstream.ok) {
      return upstream;
    }

    const detail = truncate(await upstream.text(), 1000);
    const err = new UpstreamError(provider.name, upstream.status, detail);
    lastErr = err;

    if (!shouldRetry(upstream.status)) {
      throw err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  throw new UpstreamError(provider.name, 500, "unknown error");
}

function nextProviderKey(provider: ProviderConfig): string {
  const key = provider.keys[provider.keyIndex % provider.keys.length];
  provider.keyIndex = (provider.keyIndex + 1) % provider.keys.length;
  return key;
}

function shouldRetry(status: number): boolean {
  return status === 401 || status === 408 || status === 409 || status === 429 || status >= 500;
}

function extractUsage(payload: OpenAIStylePayload): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const usage = asRecord(payload.usage);
  const promptTokens = toNonNegativeInt(usage.prompt_tokens);
  const completionTokens = toNonNegativeInt(usage.completion_tokens);
  const totalTokens =
    toNonNegativeInt(usage.total_tokens) ||
    Math.max(0, promptTokens + completionTokens);

  return { promptTokens, completionTokens, totalTokens };
}

function calculateUsageCostCents(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens * PRICE_INPUT_PER_1M_CENTS) / 1_000_000;
  const outputCost = (completionTokens * PRICE_OUTPUT_PER_1M_CENTS) / 1_000_000;
  const total = Math.ceil(inputCost + outputCost);

  if (total === 0 && promptTokens + completionTokens > 0) {
    return 1;
  }

  return Math.max(0, total);
}

function toMoney(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function resolveUsagePeriod(fromRaw: string | null, toRaw: string | null): { from: string; to: string; fromMs: number; toMs: number } | null {
  const today = formatDateUtc(Date.now());
  const toDate = toRaw && toRaw.trim() ? toRaw.trim() : today;
  const toRange = parseDateYmdRange(toDate);
  if (!toRange) {
    return null;
  }

  const defaultFromDate = formatDateUtc(toRange.startMs - 29 * 24 * 60 * 60 * 1000);
  const fromDate = fromRaw && fromRaw.trim() ? fromRaw.trim() : defaultFromDate;
  const fromRange = parseDateYmdRange(fromDate);
  if (!fromRange) {
    return null;
  }

  if (fromRange.startMs > toRange.endMs) {
    return null;
  }

  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (toRange.endMs - fromRange.startMs > maxRangeMs) {
    return null;
  }

  return {
    from: fromRange.date,
    to: toRange.date,
    fromMs: fromRange.startMs,
    toMs: toRange.endMs,
  };
}

function parseDateYmdRange(date: string): { date: string; startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const check = new Date(startMs);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }

  return {
    date,
    startMs,
    endMs: startMs + 24 * 60 * 60 * 1000 - 1,
  };
}

function formatDateUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseAmountToCents(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(n * 100);
}

function readAccountId(raw: unknown, fallback: string): string | null {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^[a-zA-Z0-9_:-]{3,128}$/.test(value)) {
    return null;
  }
  return value;
}

function readShortText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") {
    return "";
  }
  const value = raw.trim();
  if (!value) {
    return "";
  }
  return value.slice(0, maxLen);
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.floor(n);
}

function toNonNegativeInt(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  type: string,
  req: Request,
): Response {
  return json(
    {
      error: {
        code,
        type,
        message,
        request_id: requestIdFrom(req),
      },
    },
    status,
  );
}

function attachBillingHeaders(response: Response, chargedCents: number, balanceCents: number): Response {
  const headers = new Headers(response.headers);
  headers.set("x-router-charged-cents", String(chargedCents));
  headers.set("x-router-balance-cents", String(balanceCents));
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  const outHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...(headers || {}),
  });
  return new Response(JSON.stringify(body), {
    status,
    headers: outHeaders,
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders();
  for (const [k, v] of Object.entries(cors)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-request-id",
  };
}
