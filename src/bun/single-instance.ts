export function computeDesktopControlPort(serverPort: number, rawEnvValue?: string): number {
  const fromEnv = Number.parseInt(
    typeof rawEnvValue === "string" ? rawEnvValue : process.env.CLAWOS_DESKTOP_CONTROL_PORT || "",
    10
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv <= 65535) {
    return fromEnv;
  }

  const derived = serverPort + 71;
  if (derived <= 65535) {
    return derived;
  }
  return Math.max(1, serverPort - 71);
}
