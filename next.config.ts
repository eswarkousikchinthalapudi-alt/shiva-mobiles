import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Photos are already resized and served from /media; the built-in image
  // optimizer isn't used, so it stays switched off.
  images: { unoptimized: true },
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "opentype.js"],
  // Fonts for photo watermarks and WhatsApp posters, and SQL migrations,
  // are read from disk at runtime; make sure they are shipped.
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**", "./drizzle/**"],
  },
  experimental: {
    serverActions: {
      // Photos are resized in the browser first; this is a safety margin.
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
