import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this project — silences the
  // "multiple lockfiles detected" warning when other package.json
  // files exist higher in the home directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow larger request bodies for email API (inline images, attachments)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
