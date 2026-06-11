import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduling — SMRX / SMMS Pharmacy",
  description: "Pharmacy scheduling, live status, and ratio management",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
