/** @type {import('next').NextConfig} */
const nextConfig = {
  // serverActions.bodySizeLimit moved to experimental in Next.js 13,
  // then promoted to a top-level key in Next.js 14+.
  // The old `serverActions: {}` key was removed — use `experimental` wrapper instead.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // NEXTAUTH_URL is read automatically by next-auth from process.env.
  // Re-exporting it here causes a duplicate warning — remove it.
};

export default nextConfig;
