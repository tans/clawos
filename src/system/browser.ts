import { spawn } from "node:child_process";

function shouldAutoOpenBrowser(): boolean {
  const value = process.env.CLAWOS_AUTO_OPEN_BROWSER?.trim().toLowerCase();
  if (!value) {
    return true;
  }
  return !["0", "false", "no", "off"].includes(value);
}

function browserOpenCommand(url: string): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "", url],
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url],
    };
  }

  return {
    command: "xdg-open",
    args: [url],
  };
}

export function openBrowser(url: string): void {
  if (!shouldAutoOpenBrowser()) {
    return;
  }

  const { command, args } = browserOpenCommand(url);

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`自动打开浏览器失败：${message}`);
      console.warn(`请手动访问：${url}`);
    });
    child.unref();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`自动打开浏览器失败：${message}`);
    console.warn(`请手动访问：${url}`);
  }
}
