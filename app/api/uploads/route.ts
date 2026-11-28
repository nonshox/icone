import "server-only";

import { type NextRequest } from "next/server";

import { requireUser } from "@/lib/api/guard";
import { isImageFile, MAX_UPLOAD_BYTES, uploadImage } from "@/lib/domain/upload";
import { apiError, apiOk, isSameOrigin, tooManyRequests } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

type Folder = Parameters<typeof uploadImage>[1];

const FOLDERS = new Set<Folder>([
  "avatar",
  "logo",
  "cover",
  "portfolio",
  "service",
]);

/**
 * POST /api/uploads — store one image in Appwrite Storage.
 *
 * The file is sent as multipart/form-data. We never read a filename or path
 * from the client: the domain generates the stored id from the folder plus a
 * unique suffix. The row that references the image keeps only that id.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError(
      "This request came from an unexpected origin.",
      403,
      "bad_origin",
    );
  }

  const guarded = await requireUser();
  if (!guarded.ok) return guarded.response;

  const limit = await rateLimit(`upload:${guarded.actor.userId}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // Cheap guard before the body is parsed; the domain still checks the real
  // File size because this header is optional and can be omitted entirely.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return apiError("That image is larger than 5 MB.", 413, "invalid_file");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Invalid upload. Send a form with a file.", 400, "invalid_body");
  }

  const folder = form.get("folder");
  if (typeof folder !== "string" || !FOLDERS.has(folder as Folder)) {
    return apiError("Choose where to save this image.", 400, "invalid_folder");
  }

  const file = form.get("file");
  if (!(file instanceof File) || !isImageFile(file)) {
    return apiError(
      "Use a JPEG, PNG, WebP or AVIF image up to 5 MB.",
      400,
      "invalid_file",
    );
  }

  try {
    const result = await uploadImage(file, folder as Folder);
    if (!result.ok) return apiError(result.message, 400, "upload_failed");
    return apiOk({ id: result.id, url: result.url });
  } catch (error) {
    console.error("[api] upload failed", error);
    return apiError("The upload did not finish. Try again.", 502, "upload_failed");
  }
}
