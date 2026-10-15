import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Zedu Bugs",
    template: "%s · Zedu Bugs",
  },
  description: "Zedu bug tracking interface — HNG15 mini-project",
  openGraph: {
    siteName: "Zedu Bugs",
    type: "website",
    images: [{ url: "/zedu-mark.svg", alt: "Zedu Bugs" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/zedu-mark.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
