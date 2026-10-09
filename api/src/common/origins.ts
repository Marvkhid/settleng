/**
 * CORS origin check. Exact URLs match exactly. A single "*" inside a hostname matches ONE label
 * only (letters, digits, hyphen), so "https://settleng-*.vercel.app" allows Vercel preview URLs
 * but not "https://evil.com/.vercel.app" or "https://settleng-a.b.vercel.app".
 */
export function originAllowed(
  origin: string | undefined,
  allowed: string[],
): boolean {
  if (!origin) return true; // not a browser cross-origin request (curl, health checks)
  const o = origin.toLowerCase().replace(/\/+$/, '');
  return allowed.some((rule) => {
    const r = rule.toLowerCase().replace(/\/+$/, '');
    if (!r.includes('*')) return r === o;
    const pattern = r
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[a-z0-9-]+');
    return new RegExp(`^${pattern}$`).test(o);
  });
}
