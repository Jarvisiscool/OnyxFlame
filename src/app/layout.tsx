import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({ src: "./fonts/manrope.woff2", variable: "--font-manrope", weight: "200 800", display: "swap" });

export const metadata: Metadata = {
  title: "Second Look: calm scam protection for the whole family",
  description: "Checks texts, calls, voicemails and links privately before you act on them, explains the call in plain words, and slows you down when it matters. Built with NVIDIA Nemotron.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f5f7" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
