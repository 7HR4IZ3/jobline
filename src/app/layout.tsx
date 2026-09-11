import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobline — Shared job scheduler",
  description: "A simple cloud-synced calendar for planning jobs, quotes, and payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
