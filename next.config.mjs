/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error"] }
        : false
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups"
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
