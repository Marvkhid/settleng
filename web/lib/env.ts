/** Public API base URL. Read from the environment; never hardcode a host. */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local.");
  }
  return url.replace(/\/+$/, "");
}
