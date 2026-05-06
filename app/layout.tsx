import type { Metadata } from "next";
import "./globals.css";
import SessionProviderClient from "@/components/SessionProviderClient";

export const metadata: Metadata = {
  title: "Companies Dashboard",
  description: "Multi-company financial dashboard — Supra Pacific",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderClient>{children}</SessionProviderClient>
      </body>
    </html>
  );
}
