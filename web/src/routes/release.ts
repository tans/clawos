import { Hono } from "hono";
import {
  listPublishedMcpShelf,
  listPublishedProducts,
  listMcpReleaseVersions,
  listMcpReleases,
  normalizeReleaseChannel,
  readMcpRelease,
} from "../lib/storage";
import { executeMcpPanelAction, listMcpPanels, readMcpPanelData, readMcpPanelSchema } from "../lib/mcp-panel";
import type { ReleaseChannel } from "../lib/types";

export const releaseRoutes = new Hono();

function channelSuffix(channel: ReleaseChannel): string {
  return channel === "stable" ? "" : `?channel=${channel}`;
}

releaseRoutes.get("/api/mcps", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const items = await listMcpReleases(channel);
  return c.json({ ok: true, channel, items });
});

releaseRoutes.get("/api/mcps/shelf", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const items = await listPublishedMcpShelf(channel);
  return c.json({ ok: true, channel, items });
});

releaseRoutes.get("/api/mcps/panels", async (c) => {
  const items = await listMcpPanels();
  return c.json({ ok: true, items });
});

releaseRoutes.get("/api/mcps/:mcpId/panel-schema", async (c) => {
  const mcpId = c.req.param("mcpId");
  const schema = await readMcpPanelSchema(mcpId);
  if (!schema) return c.json({ ok: false, error: "MCP Panel 不存在", code: "MCP_PANEL_NOT_FOUND" }, 404);
  return c.json({ ok: true, item: schema });
});

releaseRoutes.get("/api/mcps/:mcpId/panel-data", async (c) => {
  const mcpId = c.req.param("mcpId");
  const data = await readMcpPanelData(mcpId);
  if (!data) return c.json({ ok: false, error: "MCP Panel 不存在", code: "MCP_PANEL_NOT_FOUND" }, 404);
  return c.json({ ok: true, item: data });
});

releaseRoutes.post("/api/mcps/:mcpId/actions/:actionId", async (c) => {
  const mcpId = c.req.param("mcpId");
  const actionId = c.req.param("actionId");
  const body = await c.req.json().catch(() => ({}));
  const ret = await executeMcpPanelAction({ mcpId, actionId, payload: body?.payload });
  if (!ret.ok) {
    const status =
      ret.code === "MCP_PANEL_NOT_FOUND" || ret.code === "MCP_ACTION_NOT_FOUND"
        ? 404
        : ret.code === "MCP_ACTION_PAYLOAD_INVALID"
          ? 400
          : 500;
    return c.json({ ok: false, ...ret }, status);
  }
  return c.json({ ok: true, ...ret }, 200);
});

releaseRoutes.get("/api/mcps/:mcpId", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const item = await readMcpRelease(c.req.param("mcpId"), channel);
  if (!item) return c.json({ ok: false, error: "MCP 不存在" }, 404);
  return c.json({ ok: true, channel, item });
});

releaseRoutes.get("/api/mcps/:mcpId/versions", async (c) => {
  const channel = normalizeReleaseChannel(c.req.query("channel") || undefined) || "stable";
  const mcpId = c.req.param("mcpId");
  const versions = await listMcpReleaseVersions(mcpId, channel);
  if (versions.length === 0) return c.json({ ok: false, error: "MCP 不存在" }, 404);
  return c.json({
    ok: true,
    channel,
    mcpId,
    items: versions.map((item) => ({
      ...item,
      downloadUrl: `/downloads/mcp/${encodeURIComponent(item.id)}/${encodeURIComponent(item.version)}${channelSuffix(channel)}`,
    })),
  });
});

releaseRoutes.get("/api/products", async (c) => {
  const items = await listPublishedProducts();
  return c.json({ ok: true, items });
});
