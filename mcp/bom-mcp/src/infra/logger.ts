export function logInfo(event: string, payload?: Record<string, unknown>): void {
  console.info(`[bom-mcp] ${event}`, payload || {});
}

export function logWarn(event: string, payload?: Record<string, unknown>): void {
  console.warn(`[bom-mcp] ${event}`, payload || {});
}
