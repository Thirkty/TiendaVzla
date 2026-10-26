import type { NextConfig } from "next";

// Las fotos que suben los vendedores las sirve la API en /uploads.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // picsum.photos redirige a fastly.picsum.photos, por eso permitimos ambos hosts.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/uploads/**",
      },
    ],
    // En desarrollo la API está en localhost, que Next bloquea por defecto (riesgo SSRF).
    // En producción la API tiene dominio público y esto queda apagado.
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
