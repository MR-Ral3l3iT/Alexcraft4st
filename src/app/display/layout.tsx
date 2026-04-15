import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Check-in display"
};

export default function DisplayLayout({ children }: { children: ReactNode }) {
  return children;
}
