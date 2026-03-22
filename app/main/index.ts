import Electrobun from "electrobun";
import { createConnection, createServer, type Server } from "node:net";
import { computeDesktopControlPort } from "./single-instance";
import { bootstrapDesktopEnvironment, startBackgroundQwGatewayAutoRestart } from "./bootstrap";
import { startBackgroundUpdateCheck } from "./updater";
import { createDesktopRpc } from "./rpc";
import {
  createDesktopWindow,
  createStartupErrorWindow,
  isDesktopDevMode,
  openOrCreateDesktopWindow,
  resolveUseInlineShellHtml,
  shouldOpenDevtools,
} from "./window";

const SINGLE_INSTANCE_HOST = "127.0.0.1";

async function notifyRunningInstance(controlPort: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: SINGLE_INSTANCE_HOST, port: controlPort });
    let resolved = false;
    const done = (value: boolean): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
    };

    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.write("focus\n", () => {
        socket.end();
        done(true);
      });
    });
    socket.once("timeout", () => {
      socket.destroy();
      done(false);
    });
    socket.once("error", () => {
      done(false);
    });
    socket.once("close", () => {
      done(resolved);
    });
  });
}

async function openControlServer(controlPort: number, onFocus: () => void): Promise<Server> {
  return await new Promise<Server>((resolve, reject) => {
    const server = createServer((socket) => {
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => {
        const text = String(chunk || "").trim().toLowerCase();
        if (text.includes("focus")) {
          onFocus();
        }
      });
      socket.on("error", () => {
        // ignore per-connection errors
      });
      socket.end("ok\n");
    });

    server.once("error", (error) => reject(error));
    server.listen(controlPort, SINGLE_INSTANCE_HOST, () => resolve(server));
  });
}

async function acquireSingleInstanceGuard(controlPort: number): Promise<{ isPrimary: boolean; server: Server | null }> {
  if (await notifyRunningInstance(controlPort)) {
    return { isPrimary: false, server: null };
  }

  try {
    const server = await openControlServer(controlPort, () => openOrCreateDesktopWindow(createDesktopRpc));
    return { isPrimary: true, server };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "EADDRINUSE" && (await notifyRunningInstance(controlPort))) {
      return { isPrimary: false, server: null };
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const controlPort = computeDesktopControlPort();
  const useInlineShellHtml = resolveUseInlineShellHtml();
  console.log(`[desktop] booting ClawOS shell (${useInlineShellHtml ? "inline html" : "views url"})`);
  console.log(`[desktop] single-instance control at ${SINGLE_INSTANCE_HOST}:${controlPort}`);

  if (isDesktopDevMode()) {
    console.log("[desktop] dev mode enabled");
    if (shouldOpenDevtools()) {
      console.log("[desktop] devtools auto-open enabled");
    }
  }

  bootstrapDesktopEnvironment();

  const guard = await acquireSingleInstanceGuard(controlPort);
  if (!guard.isPrimary) {
    console.log("[desktop] another instance is active; requested focus and exiting.");
    process.exit(0);
    return;
  }

  Electrobun.events.on("before-quit", () => {
    guard.server?.close();
  });

  try {
    createDesktopWindow(createDesktopRpc);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[desktop] failed to bootstrap desktop UI: ${message}`);
    createStartupErrorWindow(message);
  }

  startBackgroundQwGatewayAutoRestart();
  startBackgroundUpdateCheck();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop] fatal startup error: ${message}`);
  process.exit(1);
});
