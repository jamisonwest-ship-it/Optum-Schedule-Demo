import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal scheduling tool — block search engine indexing at the header level
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
