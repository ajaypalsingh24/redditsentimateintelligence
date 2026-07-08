import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reddify Sentiment Intelligence",
  description: "Track Reddit sentiment, scan history, project dashboards, and export-ready reports.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
