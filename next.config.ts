import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow larger request bodies for email API (inline images, attachments)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
