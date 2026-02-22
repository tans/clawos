import { Hono } from "hono";
import { resolveLatestInstaller, resolveLatestXiakeConfig } from "../lib/storage";

export const downloadRoutes = new Hono();

function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

downloadRoutes.get("/downloads/latest", async (c) => {
  try {
    const { absolutePath, asset } = await resolveLatestInstaller();
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": contentDisposition(asset.name),
        "x-file-sha256": asset.sha256,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});

downloadRoutes.get("/downloads/clawos_xiake.json", async (c) => {
  try {
    const { absolutePath, asset } = await resolveLatestXiakeConfig();
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": contentDisposition("clawos_xiake.json"),
        "x-file-sha256": asset.sha256,
      },
    });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 404);
  }
});
