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
  const metaEl = root.querySelector("[data-app-update-meta]");
  const actionEl = document.createElement("div");
  actionEl.className = "mt-2 flex flex-wrap gap-2";
  root.appendChild(actionEl);

  if (!(versionEl instanceof HTMLElement) || !(metaEl instanceof HTMLElement)) {
    return;
  }

  function formatIsoTime(raw) {
    if (typeof raw !== "string" || !raw.trim()) {
      return "";
    }
    const time = new Date(raw);
    if (Number.isNaN(time.getTime())) {
      return "";
    }
    return time.toLocaleString("zh-CN", { hour12: false });
  }

  function createButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderActionButtons(buttons) {
    actionEl.textContent = "";
    for (const button of buttons) {
      actionEl.appendChild(button);
    }
  }

  let taskPollTimer = null;
  let refreshing = false;

  function stopTaskPoll() {
    if (!taskPollTimer) {
      return;
    }
    clearInterval(taskPollTimer);
    taskPollTimer = null;
  }

  async function refreshVersionOnly() {
    try {
      const data = await api("/api/health");
      const current = typeof data?.version === "string" && data.version.trim() ? data.version.trim() : "未知";
      versionEl.textContent = `v${current}`;
    } catch {
      versionEl.textContent = "v-";
    }
  }

  function renderManualDownload(reason) {
    const message = typeof reason === "string" && reason.trim() ? reason.trim() : "当前环境不支持自动更新。";
    metaEl.textContent = "";
    metaEl.append(document.createTextNode(`${message} `));
    const link = document.createElement("a");
    link.className = "link link-primary";
    link.href = CLAWOS_DOWNLOAD_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "手动下载";
    metaEl.append(link);
    renderActionButtons([
      createButton("重新检查", "btn btn-ghost btn-xs", () => {
        void refreshUpdateStatus(false);
      }),
    ]);
  }

  async function pollUpdateTask(taskId) {
    try {
      const data = await api(`/api/tasks/${encodeURIComponent(taskId)}`);
      const task = data?.task || null;
      if (!task) {
        stopTaskPoll();
        return;
      }

      const lastLog =
        Array.isArray(task.logs) && task.logs.length > 0 ? task.logs[task.logs.length - 1] : null;
      const stepText =
        typeof task.step === "number" && typeof task.totalSteps === "number" && task.totalSteps > 0
          ? `步骤 ${task.step}/${task.totalSteps}`
          : "执行中";
      const logText =
        lastLog && typeof lastLog.message === "string" && lastLog.message.trim()
          ? lastLog.message.trim()
          : "任务进行中...";
      metaEl.textContent = `${stepText}：${logText}`;

      if (task.status === "failed") {
        stopTaskPoll();
        renderActionButtons([
          createButton("重新检查", "btn btn-ghost btn-xs", () => {
            void refreshUpdateStatus(false);
          }),
        ]);
        return;
      }

      if (task.status === "success") {
        stopTaskPoll();
        renderActionButtons([
          createButton("重新检查", "btn btn-ghost btn-xs", () => {
            void refreshUpdateStatus(false);
          }),
        ]);
      }
    } catch {
      stopTaskPoll();
    }
  }

  async function startUpdate() {
    stopTaskPoll();
    metaEl.textContent = "正在启动更新任务...";
    renderActionButtons([
      createButton("更新中...", "btn btn-primary btn-xs pointer-events-none opacity-70", () => {}),
    ]);

    try {
      const data = await api("/api/app/update/run", {
        method: "POST",
        body: JSON.stringify({ autoRestart: true }),
      });
      const taskId = typeof data?.taskId === "string" ? data.taskId : "";
      if (!taskId) {
        throw new Error("更新任务未返回 taskId。");
      }
      metaEl.textContent = "更新任务已启动，下载完成后将自动重启。";
      taskPollTimer = setInterval(() => {
        void pollUpdateTask(taskId);
      }, 1500);
      void pollUpdateTask(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `启动更新失败：${message}`;
      renderActionButtons([
        createButton("重新检查", "btn btn-ghost btn-xs", () => {
          void refreshUpdateStatus(false);
        }),
      ]);
    }
  }

  async function refreshUpdateStatus(silent) {
    if (refreshing) {
      return;
    }
    refreshing = true;
    try {
      if (!silent) {
        metaEl.textContent = "正在检查更新...";
      }
      await refreshVersionOnly();
      const data = await api("/api/app/update/status");
      const status = data?.status || {};

      if (!status.supported) {
        renderManualDownload(status.reason);
        return;
      }

      if (status.error) {
        metaEl.textContent = `检查更新失败：${status.error}`;
        renderActionButtons([
          createButton("重新检查", "btn btn-ghost btn-xs", () => {
            void refreshUpdateStatus(false);
          }),
        ]);
        return;
      }

      const checkedAt = formatIsoTime(status.checkedAt);
      if (status.hasUpdate) {
        metaEl.textContent = `发现新版本 v${status.remoteVersion || "?"}（当前 v${status.currentVersion || "?"}）`;
        renderActionButtons([
          createButton("更新并重启", "btn btn-primary btn-xs", () => {
            void startUpdate();
          }),
          createButton("重新检查", "btn btn-ghost btn-xs", () => {
            void refreshUpdateStatus(false);
          }),
        ]);
        return;
      }

      metaEl.textContent = checkedAt ? `已是最新版本（检查时间：${checkedAt}）` : "已是最新版本。";
      renderActionButtons([
        createButton("重新检查", "btn btn-ghost btn-xs", () => {
          void refreshUpdateStatus(false);
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metaEl.textContent = `检查更新失败：${message}`;
      renderActionButtons([
        createButton("重新检查", "btn btn-ghost btn-xs", () => {
          void refreshUpdateStatus(false);
        }),
      ]);
    } finally {
      refreshing = false;
    }
  }

  void refreshUpdateStatus(false);
  setInterval(() => {
    void refreshUpdateStatus(true);
  }, 5 * 60 * 1000);
})();
