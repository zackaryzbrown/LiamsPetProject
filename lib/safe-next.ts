// Guards user-provided `next` values used for post-auth redirects.
// Only allow site-internal absolute paths like `/account` or `/vote?x=1`.
export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}
