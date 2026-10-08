import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airlock — your data stays here",
  description: "A local privacy gateway between your private data and cloud AI.",
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
