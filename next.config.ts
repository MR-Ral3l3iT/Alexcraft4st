import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    try {
      const parsed = new URL(appBaseUrl);
      origins.add(parsed.hostname);
      origins.add(parsed.origin);
    } catch {
      // ignore invalid APP_BASE_URL
    }
  }
  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  turbopack: {
    root: __dirname
  }
};

export default nextConfig;
