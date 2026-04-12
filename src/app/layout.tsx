import type { Metadata } from "next";
import { kanit } from "@/fonts";
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
      <body className={kanit.className}>{children}</body>
    </html>
  );
}
