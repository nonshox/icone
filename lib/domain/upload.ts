import "server-only";

import { AppwriteException, ID, Storage } from "node-appwrite";

import { bucketId } from "@/lib/appwrite/db";
import { createAdminClient } from "@/lib/appwrite/server";

/**
 * Image uploads.
 *
 * Everything is validated on the server: only raster images are accepted,
 * only within a fixed size, and the stored name is generated here so a
 * client can never choose a path or overwrite somebody else's file.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadResult =
  | { ok: true; id: string; url: string }
  | { ok: false; message: string };

function storage(): Storage {
  return new Storage(createAdminClient());
}

function extension(type: string): string | null {
  return ALLOWED[type] ?? null;
}

/** Never trust the client's MIME label: inspect the file signature. */
async function hasImageSignature(file: File, ext: string): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (ext === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === "png")
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  if (ext === "webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (ext === "avif") return ascii.slice(4, 12).startsWith("ftypavif");
  return false;
}

/** Public URL for a stored file, or "" for anything we do not recognise. */
export function fileUrl(name: string): string {
  if (!name) return "";
  if (/^(https?:|data:|blob:)/.test(name)) return name;

  const env = process.env;
  const endpoint = env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
  const project = env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
  const publicBucket = env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "";

  if (!endpoint || !project) return name;

  return `${endpoint.replace(/\/$/, "")}/storage/buckets/${encodeURIComponent(
    publicBucket || bucketId(),
  )}/files/${encodeURIComponent(name)}/view?project=${project}`;
}

/** Strip the URL back down to the stored file name, for deletes and reads. */
export function fileOf(url: string): string {
  if (!url) return "";
  const match = /\/files\/([^/?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : url;
}

/**
 * Store one image and hand back its public URL.
 *
 * The folder argument is a prefix only — it never becomes a real path — so a
 * portfolio upload cannot collide with a logo even if the names match.
 */
export async function uploadImage(
  file: File,
  folder: "avatar" | "logo" | "cover" | "portfolio" | "service",
): Promise<UploadResult> {
  const type = file.type;
  const ext = extension(type);

  if (!ext) {
    return { ok: false, message: "Use a JPEG, PNG, WebP or AVIF image." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That image is larger than 5 MB." };
  }

  if (file.size === 0) {
    return { ok: false, message: "That file is empty." };
  }

  if (!(await hasImageSignature(file, ext))) {
    return { ok: false, message: "That file is not a real image." };
  }

  const name = `${folder}-${ID.unique()}.${ext}`;

  try {
    await storage().createFile({
      bucketId: bucketId(),
      fileId: name,
      file,
      // New Appwrite permission syntax: action("role"), i.e. public read.
      permissions: ['read("any")'],
    });

    // The row stores `id`; the URL is only for immediate preview.
    return { ok: true, id: name, url: fileUrl(name) };
  } catch (error) {
    if (error instanceof AppwriteException) {
      console.error("[upload] failed", error.code, error.message);
      return { ok: false, message: "The upload did not finish. Try again." };
    }
    throw error;
  }
}

/** Remove a stored image. Missing files are treated as already gone. */
export async function deleteImage(url: string): Promise<void> {
  const name = fileOf(url);
  if (!name || /^(https?:|data:|blob:)/.test(url)) return;

  try {
    await storage().deleteFile({ bucketId: bucketId(), fileId: name });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return;
    console.error("[upload] delete failed", error);
  }
}

/** Replace one image: store the new one first, then drop the old one. */
export async function replaceImage(
  current: string,
  file: File,
  folder: Parameters<typeof uploadImage>[1],
): Promise<UploadResult> {
  const result = await uploadImage(file, folder);
  if (!result.ok) return result;

  if (current) await deleteImage(current);
  return result;
}

/** Cheap guard used by the upload route before any work happens. */
export function isImageFile(file: File): boolean {
  return Boolean(extension(file.type)) && file.size <= MAX_UPLOAD_BYTES;
}
