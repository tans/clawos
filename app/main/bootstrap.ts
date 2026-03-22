import { ensureLocalConfigTemplateFile } from "../server/config/local";
import { detectAndPersistOpenclawExecutionEnvironment } from "../server/system/openclaw-execution";
import { startQwGatewayRestartTaskOnStartup } from "../server/tasks/gateway";

const SHOULD_AUTO_START_QW_GATEWAY = !["0", "false", "no", "off"].includes(
  (process.env.CLAWOS_AUTO_START_QW_GATEWAY || "").trim().toLowerCase()
);

export function bootstrapDesktopEnvironment(): void {
  try {
    ensureLocalConfigTemplateFile();
    void detectAndPersistOpenclawExecutionEnvironment().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[desktop] failed to detect execution environment: ${message}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to detect execution environment: ${message}`);
  }
}

export function startBackgroundQwGatewayAutoRestart(): void {
  if (!SHOULD_AUTO_START_QW_GATEWAY) {
    console.log("[desktop] qw gateway auto-start disabled");
    return;
  }

  try {
    const { task, reused } = startQwGatewayRestartTaskOnStartup();
    console.log(`[desktop] qw gateway startup task ${reused ? "reused" : "started"}: ${task.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to start qw gateway startup task: ${message}`);
  }
}
