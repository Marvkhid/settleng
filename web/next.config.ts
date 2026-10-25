import type { NextConfig } from "next";

// On Vercel, a build without the API address would deploy a site that cannot load any data. Fail the build instead.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. In Vercel: Project Settings > Environment Variables, add it (your API URL, e.g. https://settleng-api.onrender.com), then redeploy.",
  );
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root so Turbopack doesn't jump up to a parent lockfile. The web app owns
  // web/package-lock.json; there is intentionally no root lockfile.
  // Disable Turbopack to avoid lightningcss native module error (
  // VERCEL_TURBO_DISABLED=true is set in project env vars, but adding turbo config here ensures
  // SWC is used even if Turbopack is enabled on the Vercel dashboard)
  turbo: {
    disable: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
