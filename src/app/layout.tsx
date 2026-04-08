import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alexcraft 2026",
  description: "Event registration and check-in platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
