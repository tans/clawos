(function initClawosSidebar() {
  const DEFAULT_OPENCLAW_CONSOLE_URL = "http://127.0.0.1:18789";

  function normalizeOpenclawConsoleUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
      return DEFAULT_OPENCLAW_CONSOLE_URL;
    }

    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "ws:") {
        parsed.protocol = "http:";
      } else if (parsed.protocol === "wss:") {
        parsed.protocol = "https:";
      }
      return parsed.toString();
    } catch {
      return DEFAULT_OPENCLAW_CONSOLE_URL;
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
    try {
      const data = await api("/api/local/gateway");
      const gateway = data.gateway || {};
      return normalizeOpenclawConsoleUrl(gateway.url);
    } catch {
      return DEFAULT_OPENCLAW_CONSOLE_URL;
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
  const metaEl = root.querySelector("[data-app-update-meta]");

  if (!versionEl || !buttonEl || !metaEl) {
    return;
  }

  let latestStatus = null;
  let running = false;

  function taskContainsMessage(task, text) {
    if (!task || !Array.isArray(task.logs)) {
      return false;
    }
    return task.logs.some((item) => typeof item?.message === "string" && item.message.includes(text));
  }

  async function waitTaskCompletion(taskId, timeoutMs = 10_000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const data = await api(`/api/tasks/${taskId}`);
      const task = data.task || null;
      if (!task) {
        return null;
      }
      if (task.status === "success" || task.status === "failed") {
        return task;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return null;
  }

  function renderStatus(status) {
    latestStatus = status;
    const current = status.currentVersion || "unknown";
    versionEl.textContent = `v${current}`;

    buttonEl.classList.add("hidden");
    buttonEl.disabled = false;

    if (!status.supported) {
      metaEl.textContent = status.reason || "当前环境不支持自动更新";
      return;
    }

    if (status.error) {
      metaEl.textContent = `更新检查失败：${status.error}`;
      return;
    }

    if (!status.hasUpdate) {
      if (!status.remoteVersion) {
        metaEl.textContent = "暂未发布更新";
        return;
      }
      metaEl.textContent = "已是最新版本";
      return;
    }

    const remote = status.remoteVersion || "unknown";
    if (status.force) {
      metaEl.textContent = `检测到强制更新 v${remote}，正在自动更新...`;
      autoRunForceUpdate(status);
      return;
    }

    metaEl.textContent = `发现新版本 v${remote}`;
    buttonEl.textContent = `更新到 v${remote}`;
    buttonEl.classList.remove("hidden");
  }

  async function startUpdate(force) {
    if (running) {
      return;
    }

    running = true;
    buttonEl.disabled = true;
    metaEl.textContent = force ? "正在执行强制更新..." : "正在启动更新...";

    try {
      const runData = await api("/api/app/update/run", {
        method: "POST",
        body: JSON.stringify({ force: Boolean(force) }),
      });
      const taskId = runData.taskId;
      if (typeof taskId === "string" && taskId.length > 0) {
        const task = await waitTaskCompletion(taskId, 8_000);
        if (task) {
          if (task.status === "failed") {
            const message = task.error || "更新任务执行失败";
            metaEl.textContent = `更新启动失败：${message}`;
            buttonEl.disabled = false;
            running = false;
            return;
          }

          if (taskContainsMessage(task, "版本一致，无需更新。")) {
            metaEl.textContent = "已是最新版本";
            buttonEl.classList.add("hidden");
            buttonEl.disabled = false;
            running = false;
            await check();
            return;
          }
        }
      }

      metaEl.textContent = "更新任务已启动，ClawOS 将自动退出并重启。";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `更新启动失败：${message}`;
      buttonEl.disabled = false;
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
    try {
      const data = await api("/api/app/update/status");
      renderStatus(data.status || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `更新检查失败：${message}`;
    }
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

  void check();
  setInterval(() => {
    void check();
  }, 5 * 60 * 1000);
})();
