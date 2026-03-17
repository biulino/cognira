/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Unique build ID per deploy → busts /_next/static/ chunk URLs in CDN/browser caches
  generateBuildId: async () => `build-${Date.now()}`,
  async headers() {
    return [
      {
        // All HTML pages and RSC responses must revalidate — no stale app shells
        source: "/((?!_next/static|_next/image|icons|favicon\.ico).*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        // Static chunks are content-addressed (hash in filename) — safe to cache forever
        source: "/_next/static/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/home.html" },
        { source: "/intro", destination: "/landing.html" },
        { source: "/home", destination: "/home.html" },
        { source: "/plataforma", destination: "/plataforma.html" },
        { source: "/precos", destination: "/precos.html" },
        { source: "/casos-de-uso", destination: "/casos-de-uso.html" },
        { source: "/landing", destination: "/landing.html" },
        { source: "/solucoes/mystery-shopping", destination: "/solucoes/mystery-shopping.html" },
        { source: "/solucoes/retail-audit", destination: "/solucoes/retail-audit.html" },
        { source: "/solucoes/contact-center", destination: "/solucoes/contact-center.html" },
        { source: "/solucoes/pesquisa-mercado", destination: "/solucoes/pesquisa-mercado.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
