import type { NextConfig } from "next";

/**
 * The app is a fully static export: every route is prerendered to HTML and all
 * data is served as static JSON from /data. No server runtime, no functions —
 * it fits any static host (Netlify free tier included).
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: __dirname },
};

export default nextConfig;
