import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  images: {
    unoptimized: isGitHubPagesBuild,
  },
  output: isGitHubPagesBuild ? "export" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: isGitHubPagesBuild,
};

export default nextConfig;
