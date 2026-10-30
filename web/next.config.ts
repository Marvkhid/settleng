import type { NextConfig } from "next";

// On Vercel, a build without the API address would deploy a site that cannot load any data. Fail the build instead.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. In Vercel: Project Settings > Environment Variables, add it (your API URL, e.g. https://settleng-api.onrender.com), then redeploy.",
  );
}

const securityHeaders = [
  // HTTPS only. Vercel already redirects http -> https; this stops a browser from ever trying
  // plain HTTP for a subresource on the way in.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
