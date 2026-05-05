import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/data/uploads";

export function uploadPathFor(storageKey: string): string {
  return path.join(UPLOAD_DIR, storageKey);
}

export async function writeUpload(storageKey: string, buffer: Buffer): Promise<void> {
  const absPath = uploadPathFor(storageKey);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
}

export async function deleteUpload(storageKey: string): Promise<void> {
  await rm(uploadPathFor(storageKey), { force: true });
}
