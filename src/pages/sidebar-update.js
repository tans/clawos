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

  const versionEl = root.querySelector("[data-app-version]");
  const buttonEl = root.querySelector("[data-app-update-button]");
  const restartButtonEl = root.querySelector("[data-app-restart-button]");
  const progressWrapEl = root.querySelector("[data-app-update-progress-wrap]");
  const progressEl = root.querySelector("[data-app-update-progress]");
  const progressTextEl = root.querySelector("[data-app-update-progress-text]");
  const metaEl = root.querySelector("[data-app-update-meta]");

  if (!versionEl || !buttonEl || !restartButtonEl || !progressWrapEl || !progressEl || !progressTextEl || !metaEl) {
    return;
  }

  let latestStatus = null;
  let running = false;
  let restarting = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pendingRestartKey(version) {
    return `clawos-update-pending-restart-${version || "unknown"}`;
  }

  function hasPendingRestart(version) {
    return window.sessionStorage.getItem(pendingRestartKey(version)) === "1";
  }

  function markPendingRestart(version) {
    window.sessionStorage.setItem(pendingRestartKey(version), "1");
  }

  function taskContainsMessage(task, text) {
    if (!task || !Array.isArray(task.logs)) {
      return false;
    }
    return task.logs.some((item) => typeof item?.message === "string" && item.message.includes(text));
  }

  function showRestartButton(visible) {
    restartButtonEl.classList.toggle("hidden", !visible);
    if (!visible) {
      restartButtonEl.disabled = false;
      restartButtonEl.textContent = "一键重启 ClawOS";
    }
  }

  function showDownloadProgress(percent, detail) {
    progressWrapEl.classList.remove("hidden");
    if (typeof percent === "number" && Number.isFinite(percent)) {
      const normalized = Math.max(0, Math.min(100, Math.floor(percent)));
      progressEl.value = normalized;
      progressEl.setAttribute("value", String(normalized));
    } else {
      progressEl.removeAttribute("value");
    }
    progressTextEl.textContent = detail || "正在下载更新文件...";
  }

  function hideDownloadProgress() {
    progressWrapEl.classList.add("hidden");
    progressEl.value = 0;
    progressEl.setAttribute("value", "0");
    progressTextEl.textContent = "准备下载...";
  }

  function readTaskDownloadProgress(task) {
    if (!task || !Array.isArray(task.logs)) {
      return null;
    }

    for (let index = task.logs.length - 1; index >= 0; index -= 1) {
      const message = typeof task.logs[index]?.message === "string" ? task.logs[index].message.trim() : "";
      if (!message.startsWith("下载进度：")) {
        continue;
      }

      const detail = message.slice("下载进度：".length).trim();
      const matched = detail.match(/^(\d{1,3})%/);
      if (matched) {
        const percent = Number.parseInt(matched[1], 10);
        return {
          percent: Math.max(0, Math.min(100, percent)),
          detail,
        };
      }
      return { percent: null, detail };
    }

    return null;
  }

  async function waitTaskCompletion(taskId, timeoutMs = 10_000, onTick = null) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const data = await api(`/api/tasks/${taskId}`);
      const task = data.task || null;
      if (!task) {
        return null;
      }
      if (typeof onTick === "function") {
        onTick(task);
      }
      if (task.status === "success" || task.status === "failed") {
        return task;
      }
      await sleep(400);
    }

    return null;
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

  function renderStatus(status) {
    latestStatus = status;
    const current = status.currentVersion || "unknown";
    versionEl.textContent = `v${current}`;

    buttonEl.classList.add("hidden");
    buttonEl.disabled = false;

    if (!status.supported) {
      showRestartButton(false);
      if (!running) {
        hideDownloadProgress();
      }
      metaEl.textContent = status.reason || "当前环境不支持自动更新";
      return;
    }

    showRestartButton(true);

    if (status.error) {
      metaEl.textContent = `更新检查失败：${status.error}`;
      return;
    }

    if (!status.hasUpdate) {
      if (!status.remoteVersion) {
        metaEl.textContent = "暂未发布更新";
        if (!running) {
          hideDownloadProgress();
        }
        return;
      }
      metaEl.textContent = "已是最新版本";
      if (!running) {
        hideDownloadProgress();
      }
      return;
    }

    const remote = status.remoteVersion || "unknown";
    if (hasPendingRestart(remote)) {
      metaEl.textContent = `已下载 v${remote}，请手动重启后生效`;
      if (!running) {
        hideDownloadProgress();
      }
      return;
    }

    if (status.force) {
      metaEl.textContent = `检测到强制更新 v${remote}，正在执行更新（完成后请手动重启）...`;
      autoRunForceUpdate(status);
      return;
    }

    metaEl.textContent = `发现新版本 v${remote}`;
    buttonEl.textContent = `更新到 v${remote}`;
    buttonEl.classList.remove("hidden");
  }

  async function startUpdate(force) {
    if (running || restarting) {
      return;
    }

    running = true;
    buttonEl.disabled = true;
    restartButtonEl.disabled = true;
    metaEl.textContent = force ? "正在执行强制更新..." : "正在启动更新...";
    showDownloadProgress(0, "准备下载更新包...");

    try {
      const runData = await api("/api/app/update/run", {
        method: "POST",
        body: JSON.stringify({ force: Boolean(force) }),
      });
      const taskId = runData.taskId;
      if (typeof taskId === "string" && taskId.length > 0) {
        const task = await waitTaskCompletion(taskId, 15 * 60_000, (pollTask) => {
          const progress = readTaskDownloadProgress(pollTask);
          if (!progress) {
            return;
          }
          showDownloadProgress(progress.percent, progress.detail);
          if (typeof progress.percent === "number") {
            metaEl.textContent = `正在下载更新包：${progress.percent}%`;
          } else {
            metaEl.textContent = `正在下载更新包：${progress.detail}`;
          }
        });
        if (task) {
          if (task.status === "failed") {
            const message = task.error || "更新任务执行失败";
            metaEl.textContent = `更新启动失败：${message}`;
            buttonEl.disabled = false;
            restartButtonEl.disabled = false;
            hideDownloadProgress();
            running = false;
            return;
          }

          if (taskContainsMessage(task, "版本一致，无需更新。")) {
            metaEl.textContent = "已是最新版本";
            buttonEl.classList.add("hidden");
            buttonEl.disabled = false;
            restartButtonEl.disabled = false;
            hideDownloadProgress();
            running = false;
            await check();
            return;
          }

          if (task.status === "success") {
            showDownloadProgress(100, "100%（下载完成）");
            const remoteVersion =
              typeof latestStatus?.remoteVersion === "string" && latestStatus.remoteVersion.trim()
                ? latestStatus.remoteVersion.trim()
                : "";
            if (remoteVersion) {
              markPendingRestart(remoteVersion);
            }
            metaEl.textContent = remoteVersion
              ? `已下载 v${remoteVersion}，请手动重启后生效`
              : "更新任务已执行，请关闭并重新打开 ClawOS 使更新生效。";
            buttonEl.classList.add("hidden");
            buttonEl.disabled = false;
            restartButtonEl.disabled = false;
            running = false;
            return;
          }
        }
      }

      metaEl.textContent = "更新任务仍在执行，请稍候或前往控制台日志查看进度。";
      buttonEl.disabled = false;
      restartButtonEl.disabled = false;
      running = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `更新启动失败：${message}`;
      buttonEl.disabled = false;
      restartButtonEl.disabled = false;
      hideDownloadProgress();
      running = false;
    }
  }

  function autoRunForceUpdate(status) {
    const key = `clawos-force-update-${status.remoteVersion || "unknown"}`;
    const marks = window.sessionStorage;
    if (marks.getItem(key) === "1") {
      return;
    }
    marks.setItem(key, "1");
    void startUpdate(true);
  }

  async function check() {
    if (running || restarting) {
      return;
    }

    try {
      const data = await api("/api/app/update/status");
      renderStatus(data.status || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `更新检查失败：${message}`;
    }
  }

  async function restartClawos() {
    if (running || restarting) {
      return;
    }

    restarting = true;
    buttonEl.disabled = true;
    restartButtonEl.disabled = true;
    restartButtonEl.textContent = "正在重启...";
    metaEl.textContent = "正在重启 ClawOS，请稍候...";

    try {
      await api("/api/app/restart", {
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
    buttonEl.disabled = false;
    restartButtonEl.disabled = false;
    restartButtonEl.textContent = "一键重启 ClawOS";
  }

  buttonEl.addEventListener("click", async () => {
    try {
      const data = await api("/api/app/update/status");
      renderStatus(data.status || {});
      if (!latestStatus || !latestStatus.hasUpdate) {
        return;
      }
      await startUpdate(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `更新检查失败：${message}`;
    }
  });

  restartButtonEl.addEventListener("click", () => {
    void restartClawos();
  });

  void check();
  setInterval(() => {
    void check();
  }, 5 * 60 * 1000);
})();
