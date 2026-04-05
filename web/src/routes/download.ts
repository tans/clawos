import { Hono } from "hono";
import {
  getDownloadItemById,
  listPublishedDownloadItems,
  resolveDownloadItemFile,
} from "../lib/storage";

export const downloadRoutes = new Hono();

function contentDisposition(fileName: string): string {
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function contentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".tgz") || lower.endsWith(".tar.gz")) return "application/gzip";
  if (lower.endsWith(".exe")) return "application/x-msdownload";
  if (lower.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (lower.endsWith(".pkg")) return "application/x-newton-compatible-pkg";
  if (lower.endsWith(".appimage")) return "application/vnd.appimage";
  if (lower.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (lower.endsWith(".rpm")) return "application/vnd.rpm";
  return "application/octet-stream";
}

// GET /downloads — list all published download items
downloadRoutes.get("/downloads", async (c) => {
  const items = await listPublishedDownloadItems();
  return c.json({
    ok: true,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      version: item.version,
      fileCount: item.files.length,
      firstFile:
        item.files[0]
          ? {
              name: item.files[0].name,
              size: item.files[0].size,
              sha256: item.files[0].sha256,
            }
          : null,
      downloadUrl: item.files[0] ? `/downloads/${item.id}/${encodeURIComponent(item.files[0].name)}` : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
});

// GET /downloads/:itemId — download item (redirects to first file or returns item metadata)
downloadRoutes.get("/downloads/:itemId", async (c) => {
  const itemId = c.req.param("itemId");
  try {
    const item = await getDownloadItemById(itemId);
    if (!item) return c.json({ ok: false, error: "下载项不存在" }, 404);
    if (!item.published) return c.json({ ok: false, error: "下载项未发布" }, 404);
    if (item.files.length === 0) return c.json({ ok: false, error: "没有附件" }, 404);

    // Redirect to first file
    const firstFile = item.files[0];
    return c.redirect(`/downloads/${itemId}/${encodeURIComponent(firstFile.name)}`, 302);
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 500);
  }
});

// GET /downloads/:itemId/:fileName — download a specific file
downloadRoutes.get("/downloads/:itemId/:fileName", async (c) => {
  const itemId = c.req.param("itemId");
  const fileName = c.req.param("fileName");
  try {
    const { file, absolutePath } = await resolveDownloadItemFile(itemId, fileName);
    return new Response(Bun.file(absolutePath), {
      headers: {
        "content-type": contentType(file.name),
        "content-disposition": contentDisposition(file.name),
        "x-file-sha256": file.sha256,
        "x-file-size": String(file.size),
      },
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("不存在") || message.includes("不存在")) {
      return c.json({ ok: false, error: message }, 404);
    }
    return c.json({ ok: false, error: message }, 500);
  }
});
