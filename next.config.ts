import type { NextConfig } from "next";

/** Served at https://contributors.zedu.chat/bug-tracker */
const basePath = "/bug-tracker";

const nextConfig: NextConfig = {
  basePath,
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
