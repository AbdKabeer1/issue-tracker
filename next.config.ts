import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const nextConfig: NextConfig = {
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),
  env: {
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL ||
      (BASE_PATH
        ? `https://contributors.zedu.chat${BASE_PATH}/api/auth`
        : "https://issues.zedu.chat/api/auth"),
  },
  async redirects() {
    if (!BASE_PATH) {
      return [
        {
          source: "/bug-tracker",
          destination: "/",
          permanent: true,
        },
        {
          source: "/bug-tracker/:path*",
          destination: "/:path*",
          permanent: true,
        },
      ];
    }
    return [];
  },
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
