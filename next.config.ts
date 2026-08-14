import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. ADD THIS: Limit Next.js build workers to fix SIGBUS/memory exhaustion on Vercel
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  
  // 2. ADD THIS: Saves a massive amount of RAM by skipping source maps during the build
  productionBrowserSourceMaps: false,

  // Your existing image config remains completely unchanged below
  images: {
    dangerouslyAllowLocalIP:
      process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_IMAGE_IP === "true",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "oiqylotagjxpzhopnidv.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9000",
      },
      {
        protocol: "http",
        hostname: "minio",
        port: "9000",
      },
    ],
  },
};

export default nextConfig;
