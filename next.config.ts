import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce JS bundle: only import the icons/utilities actually used at build time
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "date-fns",
      "recharts",
    ],
  },

  // Image optimisation — serve AVIF/WebP and cache aggressively
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    minimumCacheTTL: 3600,
  },

  // Compress responses
  compress: true,
};

export default nextConfig;
