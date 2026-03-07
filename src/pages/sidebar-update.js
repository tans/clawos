(function initClawosSidebar() {
  function resolveViewportHeightPx() {
    const visualHeight =
      typeof window.visualViewport?.height === "number" && Number.isFinite(window.visualViewport.height)
        ? window.visualViewport.height
        : 0;
    const baseHeight = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
    const resolved = Math.max(visualHeight || 0, baseHeight || 0);
    if (!Number.isFinite(resolved) || resolved <= 0) {
      return 0;
    }
    return Math.round(resolved);
  }

  function applyViewportHeightVar() {
    const height = resolveViewportHeightPx();
    if (height <= 0) {
      return;
    }
    document.documentElement.style.setProperty("--app-vh", `${height}px`);
  }

  applyViewportHeightVar();
  const viewportSyncKey = "__clawosViewportHeightSyncBound__";
  if (!window[viewportSyncKey]) {
    window[viewportSyncKey] = true;
    window.addEventListener("resize", applyViewportHeightVar, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyViewportHeightVar, { passive: true });
    }
  }

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
  const metaEl = root.querySelector("[data-app-update-meta]");

  if (!(versionEl instanceof HTMLElement) || !(metaEl instanceof HTMLElement)) {
    return;
  }

  let refreshing = false;

  async function refreshLocalVersion() {
    try {
      const data = await api("/api/health");
      const current = typeof data?.version === "string" && data.version.trim() ? data.version.trim() : "未知";
      versionEl.textContent = `v${current}`;
      return current;
    } catch {
      versionEl.textContent = "v-";
      return null;
    }
  }

  function renderGotoHomeLink(prefixText) {
    metaEl.textContent = "";
    if (prefixText) {
      metaEl.append(document.createTextNode(`${prefixText} `));
    }
    const link = document.createElement("a");
    link.className = "link link-primary";
    link.href = CLAWOS_DOWNLOAD_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "clawos.cc";
    metaEl.append(link);
  }

  async function refreshReleaseHint(silent) {
    if (refreshing) {
      return;
    }
    refreshing = true;
    try {
      if (!silent) {
        metaEl.textContent = "正在获取版本信息...";
      }
      const currentVersion = await refreshLocalVersion();
      const data = await api("/api/app/update/status");
      const status = data?.status || {};

      if (status.error || !status.supported) {
        metaEl.textContent = "版本信息暂不可用�?;
        return;
      }

      const remoteVersion =
        typeof status.remoteVersion === "string" && status.remoteVersion.trim() ? status.remoteVersion.trim() : "";
      const hasUpdate = status.hasUpdate === true && !!remoteVersion;
      if (hasUpdate) {
        renderGotoHomeLink(`发现新版�?v${remoteVersion}`);
        return;
      }

      if (currentVersion) {
        metaEl.textContent = `当前已是最新版�?v${currentVersion}`;
      } else {
        metaEl.textContent = "当前已是最新版本�?;
      }
    } catch (error) {
      metaEl.textContent = "版本信息暂不可用�?;
    } finally {
      refreshing = false;
    }
  }

  void refreshReleaseHint(false);
  setInterval(() => {
    void refreshReleaseHint(true);
  }, 5 * 60 * 1000);
})();
