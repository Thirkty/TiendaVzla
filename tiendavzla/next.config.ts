import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // picsum.photos redirige a fastly.picsum.photos, por eso permitimos ambos hosts.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
