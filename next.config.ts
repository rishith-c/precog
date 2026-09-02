import type { NextConfig } from "next";

/* Headers every serious deployment ships. A strict Content-Security-Policy is
   deliberately not here: Next's inline bootstrap scripts and the Google Fonts
   stylesheet make a strict CSP a debugging tarpit for no threat this app
   faces (no user-authored HTML is ever rendered). Add one with nonces when
   there is a reason to. */
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers }];
  },
};
export default nextConfig;
