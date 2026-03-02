(function initClawosSidebar() {
  const DEFAULT_OPENCLAW_CONSOLE_URL = "http://127.0.0.1:18789";
  const DEFAULT_OPENCLAW_TOKEN = "xiake";

  function withOpenclawToken(rawUrl, token) {
    const finalToken =
      typeof token === "string" && token.trim().length > 0
        ? token.trim()
        : DEFAULT_OPENCLAW_TOKEN;
    try {
      const parsed = new URL(rawUrl);
      parsed.searchParams.set("token", finalToken);
      return parsed.toString();
    } catch {
      return `${DEFAULT_OPENCLAW_CONSOLE_URL}?token=${encodeURIComponent(finalToken)}`;
    }
  }

  function normalizeOpenclawConsoleUrl(rawUrl, token) {
    if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
      return withOpenclawToken(DEFAULT_OPENCLAW_CONSOLE_URL, token);
    }

    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "ws:") {
        parsed.protocol = "http:";
      } else if (parsed.protocol === "wss:") {
        parsed.protocol = "https:";
      }
      return withOpenclawToken(parsed.toString(), token);
    } catch {
      return withOpenclawToken(DEFAULT_OPENCLAW_CONSOLE_URL, token);
    }
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "content-type": "application/json" },
      ...options,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `请求失败: ${res.status}`);
    }
    return data;
  }

  async function loadOpenclawConsoleUrl() {
    let token = DEFAULT_OPENCLAW_TOKEN;

    try {
      const data = await api("/api/local/settings");
      const settings = data.settings || {};
      if (typeof settings.openclawToken === "string" && settings.openclawToken.trim().length > 0) {
        token = settings.openclawToken.trim();
      }
    } catch {
      token = DEFAULT_OPENCLAW_TOKEN;
    }

    try {
      const data = await api("/api/local/gateway");
      const gateway = data.gateway || {};
      return normalizeOpenclawConsoleUrl(gateway.url, token);
    } catch {
      return withOpenclawToken(DEFAULT_OPENCLAW_CONSOLE_URL, token);
    }
  }

  const openclawEntryButton = document.querySelector("[data-openclaw-entry]");
  if (openclawEntryButton instanceof HTMLButtonElement) {
    void (async () => {
      const openclawConsoleUrl = await loadOpenclawConsoleUrl();
      openclawEntryButton.addEventListener("click", () => {
        window.open(openclawConsoleUrl, "_blank", "noopener");
      });
    })();
  }

  const root = document.querySelector("[data-app-update-widget]");
  if (!root) {
    return;
  }

  const CLAWOS_DOWNLOAD_URL = "https://clawos.cc";
  const versionEl = root.querySelector("[data-app-version]");
  const restartButtonEl = root.querySelector("[data-app-restart-button]");
  const metaEl = root.querySelector("[data-app-update-meta]");

  if (!versionEl || !restartButtonEl || !metaEl) {
    return;
  }

  let restarting = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForServiceRecovery(timeoutMs = 25_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await sleep(1_000);
      try {
        await api("/api/health");
        return true;
      } catch {
        // ignore until timeout
      }
    }
    return false;
  }

  function renderManualUpdateMessage() {
    metaEl.innerHTML =
      `自更新已移除，请前往 <a class="link link-primary" href="${CLAWOS_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">clawos.cc</a> 下载最新版本并替换 clawos.exe。`;
  }

  async function refreshVersion() {
    try {
      const data = await api("/api/health");
      const current = typeof data?.version === "string" && data.version.trim() ? data.version.trim() : "unknown";
      versionEl.textContent = `v${current}`;
    } catch {
      versionEl.textContent = "v-";
    } finally {
      renderManualUpdateMessage();
    }
  }

  async function restartClawos() {
    if (restarting) {
      return;
    }

    restarting = true;
    restartButtonEl.disabled = true;
    restartButtonEl.textContent = "正在重启...";
    metaEl.textContent = "正在重启 ClawOS，请稍候...";

    try {
      const data = await api("/api/app/restart", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const recovered = await waitForServiceRecovery();
      if (recovered) {
        metaEl.textContent = "ClawOS 已重启，页面即将刷新。";
        restarting = false;
        window.location.reload();
        return;
      }

      metaEl.textContent = "重启命令已发送，正在等待服务恢复，请稍后刷新页面。";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `重启失败：${message}`;
    }

    restarting = false;
    restartButtonEl.disabled = false;
    restartButtonEl.textContent = "一键重启 ClawOS";
  }

  restartButtonEl.addEventListener("click", () => {
    void restartClawos();
  });

  void refreshVersion();
  setInterval(() => {
    void refreshVersion();
  }, 5 * 60 * 1000);
})();
