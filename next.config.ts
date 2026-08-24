import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: isGitHubPagesBuild,
  },
  output: isGitHubPagesBuild ? "export" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: isGitHubPagesBuild,
};

export default nextConfig;
