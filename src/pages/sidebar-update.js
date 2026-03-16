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
      throw new Error(data.error || `\u8bf7\u6c42\u5931\u8d25: ${res.status}`);
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
    runUpdateButton.textContent = remoteVersion ? `\u66f4\u65b0\u5230 v${remoteVersion}` : "\u66f4\u65b0\u5e76\u91cd\u542f";
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
      const current = typeof data?.version === "string" && data.version.trim() ? data.version.trim() : "\u672a\u77e5";
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
    setMetaText("\u6b63\u5728\u542f\u52a8\u66f4\u65b0\u4efb\u52a1...");

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
        throw new Error("\u670d\u52a1\u7aef\u672a\u8fd4\u56de\u66f4\u65b0\u4efb\u52a1 ID");
      }

      storeActiveTaskId(taskId);
      setMetaText("\u66f4\u65b0\u4efb\u52a1\u5df2\u542f\u52a8\uff0c\u6b63\u5728\u6253\u5f00\u63a7\u5236\u53f0...");
      window.dispatchEvent(
        new CustomEvent("clawos:self-update-started", {
          detail: { taskId },
        })
      );
      goToDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u542f\u52a8\u66f4\u65b0\u5931\u8d25";
      setMetaText(message || "\u542f\u52a8\u66f4\u65b0\u5931\u8d25");
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
        setMetaText("\u6b63\u5728\u83b7\u53d6\u7248\u672c\u4fe1\u606f...");
      }
      const currentVersion = await refreshLocalVersion();
      const data = await api("/api/app/update/status");
      const status = data?.status || {};

      if (status.error || !status.supported) {
        hideUpdateAction();
        setMetaText("\u7248\u672c\u4fe1\u606f\u6682\u4e0d\u53ef\u7528\u3002");
        return;
      }

      const remoteVersion =
        typeof status.remoteVersion === "string" && status.remoteVersion.trim() ? status.remoteVersion.trim() : "";
      const hasUpdate = status.hasUpdate === true && !!remoteVersion;
      if (hasUpdate) {
        setMetaText(`\u53d1\u73b0\u65b0\u7248\u672c v${remoteVersion}`);
        showUpdateAction(remoteVersion);
        return;
      }

      hideUpdateAction();
      if (currentVersion) {
        setMetaText(`\u5f53\u524d\u5df2\u662f\u6700\u65b0\u7248\u672c v${currentVersion}`);
      } else {
        setMetaText("\u5f53\u524d\u5df2\u662f\u6700\u65b0\u7248\u672c\u3002");
      }
    } catch {
      hideUpdateAction();
      setMetaText("\u7248\u672c\u4fe1\u606f\u6682\u4e0d\u53ef\u7528\u3002");
    } finally {
      refreshing = false;
    }
  }

  void refreshReleaseHint(false);
  setInterval(() => {
    void refreshReleaseHint(true);
  }, 5 * 60 * 1000);
})();
