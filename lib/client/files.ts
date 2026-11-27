/**
 * Resolve a stored image reference for display.
 *
 * Rows keep only the Appwrite file id. This helper is safe to import from a
 * client component: it uses only the public endpoint, project and bucket id.
 * Legacy absolute URLs pass through untouched so old data keeps rendering.
 */
export function imageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
  const bucket = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "";
  if (!endpoint || !project || !bucket) return "";

  return `${endpoint.replace(/\/$/, "")}/storage/buckets/${encodeURIComponent(
    bucket,
  )}/files/${encodeURIComponent(value)}/view?project=${encodeURIComponent(project)}`;
}

/** True when a value is a stored file id rather than an external URL. */
export function isStoredFile(value: string): boolean {
  return Boolean(value) && !/^(https?:|data:|blob:)/i.test(value);
}
