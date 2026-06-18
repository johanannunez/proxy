import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appDir, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  turbopack: {
    root: workspaceRoot,
  },
  experimental: {
    serverActions: {
      // Default is 1MB which is easily exceeded by base64-encoded photos.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "pwoxwpryummqeqsxdgyc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "a0.muscache.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/workspace/dashboard", destination: "/workspace/home", permanent: true },
      { source: "/workspace/messages", destination: "/workspace/inbox", permanent: true },
      { source: "/workspace/messages/:path*", destination: "/workspace/inbox/:path*", permanent: true },
      { source: "/workspace/financials", destination: "/workspace/finances", permanent: true },
      { source: "/workspace/financials/:path*", destination: "/workspace/finances/:path*", permanent: true },
      { source: "/workspace/members", destination: "/workspace/team", permanent: true },
      { source: "/workspace/members/:path*", destination: "/workspace/team/:path*", permanent: true },
      { source: "/workspace/reserve", destination: "/workspace/home", permanent: false },
      { source: "/workspace/reserve/:path*", destination: "/workspace/home", permanent: false },
      { source: "/admin/documents", destination: "/admin/paperwork", permanent: true },
      { source: "/admin/documents/:path+", destination: "/admin/paperwork/:path+", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=15552000, s-maxage=15552000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
