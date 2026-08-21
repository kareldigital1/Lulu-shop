import type { NextConfig } from "next";

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
);
const apiUsesLocalhost = ["localhost", "127.0.0.1"].includes(apiUrl.hostname);
const isDevelopment = process.env.NODE_ENV === "development";
const shouldUpgradeInsecureRequests =
  !isDevelopment && apiUrl.protocol === "https:";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiUrl.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl.origin}${isDevelopment ? " ws: wss:" : ""}`,
  "frame-src https://www.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(shouldUpgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(!isDevelopment
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/produits/robe-soir%C3%A9e",
        destination: "/produits/robe-soiree",
        permanent: true,
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: apiUsesLocalhost,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
    qualities: [25, 60, 72, 75, 82],
    remotePatterns: [
      {
        protocol: apiUrl.protocol === "https:" ? "https" : "http",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/api/uploads/**",
      },
    ],
  },
};

export default nextConfig;
