/** Only same-origin application paths may be returned from login/callback. */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    const target = new URL(value, "https://workspace.invalid");
    if (target.origin !== "https://workspace.invalid" || target.pathname === "/login" || target.pathname.startsWith("/auth/")) return fallback;
    return target.pathname + target.search + target.hash;
  } catch { return fallback; }
}
