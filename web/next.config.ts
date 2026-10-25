import type { NextConfig } from "next";

// Next's App Router needs inline scripts (no nonces here) and its dev server needs eval, so the CSP applies to production builds.
const csp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://rpc.test.mezo.org", // the vault reads and simulates on Mezo testnet from the browser
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
const prod = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // 6 KB of CSS: inline it so the first paint doesn't wait for a stylesheet request (PageSpeed: render-blocking 300 ms).
  experimental: { inlineCss: true },
  async headers() {
    return [
      // Everything except the widget: wallet pages must never sit inside someone else's frame (clickjacking).
      {
        source: "/((?!embed$).*)",
        headers: [...common, { key: "X-Frame-Options", value: "DENY" }, ...(prod ? [{ key: "Content-Security-Policy", value: csp("'none'") }] : [])],
      },
      // The widget is made to be framed by any site (public/embed.js).
      { source: "/embed", headers: [...common, ...(prod ? [{ key: "Content-Security-Policy", value: csp("*") }] : [])] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
