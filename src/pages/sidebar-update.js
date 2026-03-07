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
  const ACTIVE_TASK_STORAGE_KEY = "clawos.activeTaskId";

  function withOpenclawToken(rawUrl, token) {
    const finalToken =
      typeof token === "string" && token.trim().length > 0 ? token.trim() : DEFAULT_OPENCLAW_TOKEN;
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

  async function openOpenclawConsole(url) {
    const nativeOpen = window.__clawosDesktop?.openExternalUrl;
    if (typeof nativeOpen === "function") {
      try {
        await nativeOpen(url);
        return;
      } catch {
        // Fallback to browser-side open when native bridge is unavailable.
      }
    }
    window.open(url, "_blank", "noopener");
  }

  const openclawEntryButtons = Array.from(document.querySelectorAll("[data-openclaw-entry]"));
  if (openclawEntryButtons.length > 0) {
    void (async () => {
      const openclawConsoleUrl = await loadOpenclawConsoleUrl();
      for (const button of openclawEntryButtons) {
        if (!(button instanceof HTMLButtonElement)) {
          continue;
        }
        button.addEventListener("click", () => {
          void openOpenclawConsole(openclawConsoleUrl);
        });
      }
    })();
  }

  const root = document.querySelector("[data-app-update-widget]");
  if (!root) {
    return;
  }

  const versionEl = root.querySelector("[data-app-version]");
  const metaEl = root.querySelector("[data-app-update-meta]");
  const actionsEl = root.querySelector("[data-app-update-actions]");
  const runUpdateButton = root.querySelector("[data-app-update-run]");

  if (
    !(versionEl instanceof HTMLElement) ||
    !(metaEl instanceof HTMLElement) ||
    !(actionsEl instanceof HTMLElement) ||
    !(runUpdateButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  let refreshing = false;
  let runningUpdate = false;

  function setMetaText(text) {
    metaEl.textContent = text;
  }

  function hideUpdateAction() {
    actionsEl.classList.add("hidden");
    runUpdateButton.disabled = false;
  }

  function showUpdateAction(remoteVersion) {
    runUpdateButton.textContent = remoteVersion ? `更新到 v${remoteVersion}` : "更新并重启";
    actionsEl.classList.remove("hidden");
  }

  function storeActiveTaskId(taskId) {
    try {
      if (typeof taskId === "string" && taskId.trim()) {
        window.sessionStorage.setItem(ACTIVE_TASK_STORAGE_KEY, taskId.trim());
      }
    } catch {
      // ignore storage errors
    }
  }

  function goToDashboard() {
    if (window.location.hash !== "#/" && window.location.hash !== "#/index") {
      window.location.hash = "#/";
    }
  }

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

  async function startAppUpdate() {
    if (runningUpdate) {
      return;
    }

    runningUpdate = true;
    runUpdateButton.disabled = true;
    setMetaText("正在启动更新任务...");

    try {
      const data = await api("/api/app/update/run", {
        method: "POST",
        body: JSON.stringify({
          trigger: "manual",
          autoRestart: true,
        }),
      });
      const taskId = typeof data?.taskId === "string" ? data.taskId.trim() : "";
      if (!taskId) {
        throw new Error("服务端未返回更新任务 ID");
      }

      storeActiveTaskId(taskId);
      setMetaText("更新任务已启动，正在打开控制台...");
      window.dispatchEvent(
        new CustomEvent("clawos:self-update-started", {
          detail: { taskId },
        })
      );
      goToDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动更新失败";
      setMetaText(message || "启动更新失败");
      runUpdateButton.disabled = false;
    } finally {
      runningUpdate = false;
    }
  }

  runUpdateButton.addEventListener("click", () => {
    void startAppUpdate();
  });

  async function refreshReleaseHint(silent) {
    if (refreshing) {
      return;
    }
    refreshing = true;
    try {
      if (!silent) {
        setMetaText("正在获取版本信息...");
      }
      const currentVersion = await refreshLocalVersion();
      const data = await api("/api/app/update/status");
      const status = data?.status || {};

      if (status.error || !status.supported) {
        hideUpdateAction();
        setMetaText("版本信息暂不可用。");
        return;
      }

      const remoteVersion =
        typeof status.remoteVersion === "string" && status.remoteVersion.trim() ? status.remoteVersion.trim() : "";
      const hasUpdate = status.hasUpdate === true && !!remoteVersion;
      if (hasUpdate) {
        setMetaText(`发现新版本 v${remoteVersion}`);
        showUpdateAction(remoteVersion);
        return;
      }

      hideUpdateAction();
      if (currentVersion) {
        setMetaText(`当前已是最新版本 v${currentVersion}`);
      } else {
        setMetaText("当前已是最新版本。");
      }
    } catch {
      hideUpdateAction();
      setMetaText("版本信息暂不可用。");
    } finally {
      refreshing = false;
    }
  }

  void refreshReleaseHint(false);
  setInterval(() => {
    void refreshReleaseHint(true);
  }, 5 * 60 * 1000);
})();
