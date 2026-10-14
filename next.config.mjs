// Served at https://contributors.zedu.chat/bug-tracker
const basePath = "/bug-tracker";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath,
  // Exposes NEXTAUTH_URL (incl. its path) to the next-auth client at build time
  env: { NEXTAUTH_URL: process.env.NEXTAUTH_URL },
};
export default nextConfig;
