import type { Metadata, Viewport } from "next";
// Fonts are bundled from npm (no CDN), so the demo still works with Wi-Fi off.
import "@fontsource/cal-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airlock",
  description: "A local privacy gateway between your private data and cloud AI.",
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
