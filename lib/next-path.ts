/**
 * Only allow local paths from `?next=` so a sign-in redirect can never become
 * an open redirect to another site.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/start",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/sign-in")
  ) {
    return fallback;
  }
  return value;
}
