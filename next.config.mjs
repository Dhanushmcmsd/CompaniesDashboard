/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // Allow GitHub Codespaces and similar forwarded hostnames
  allowedDevOrigins: ["*.preview.app.github.dev", "*.githubpreview.dev"],
};

export default nextConfig;
