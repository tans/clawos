const DEFAULT_DESKTOP_CONTROL_PORT = 8151;

export function computeDesktopControlPort(rawEnvValue?: string): number {
  const fromEnv = Number.parseInt(
    typeof rawEnvValue === "string" ? rawEnvValue : process.env.CLAWOS_DESKTOP_CONTROL_PORT || "",
    10
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv <= 65535) {
    return fromEnv;
  }

  return DEFAULT_DESKTOP_CONTROL_PORT;
}
