(function initClawosSidebarUpdate() {
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
      await api("/api/app/update/run", {
        method: "POST",
        body: JSON.stringify({ force: Boolean(force) }),
      });
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
    if (!latestStatus || !latestStatus.hasUpdate) {
      return;
    }
    await startUpdate(false);
  });

  void check();
  setInterval(() => {
    void check();
  }, 5 * 60 * 1000);
})();
