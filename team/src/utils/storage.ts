import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "../db";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PersistedUpload = {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sanitizeFileName(fileName: string): string {
  const normalized = path.basename(fileName).trim();
  if (!normalized) {
    return "upload.bin";
  }
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function companyUploadDir(companyId: string): string {
  const safeCompanyId = sanitizeSegment(companyId.trim());
  if (!safeCompanyId) {
    throw new Error("INVALID_COMPANY_ID");
  }
  return path.join(UPLOAD_ROOT, safeCompanyId);
}

function resolveStoragePath(storagePath: string): string {
  const normalized = storagePath.replaceAll("\\", "/");
  const segments = normalized.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length !== 2) {
    throw new Error("INVALID_STORAGE_PATH");
  }
  const [companyId, storedName] = segments;
  return path.join(UPLOAD_ROOT, sanitizeSegment(companyId), sanitizeFileName(storedName));
}

export async function persistUpload(companyId: string, file: File): Promise<PersistedUpload> {
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("INVALID_FILE");
  }

  const originalName = sanitizeFileName(file.name);
  const extension = path.extname(originalName);
  const storedName = `${Date.now()}_${crypto.randomUUID().replaceAll("-", "")}${extension}`;
  const dir = companyUploadDir(companyId);
  await mkdir(dir, { recursive: true });

  const absolutePath = path.join(dir, storedName);
  await Bun.write(absolutePath, file);

  const safeCompanyId = path.basename(dir);
  const storagePath = path.posix.join(safeCompanyId, storedName);
  const mimeType = (file.type || "application/octet-stream").split(";")[0] || "application/octet-stream";

  return {
    originalName,
    storedName,
    mimeType,
    sizeBytes: file.size,
    storagePath,
  };
}

export async function deleteUpload(storagePath: string): Promise<void> {
  await rm(resolveStoragePath(storagePath), { force: true });
}
