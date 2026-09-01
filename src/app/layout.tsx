import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precog — neural pre-flight for web pages",
  description:
    "Run a page past a predicted brain before you run it past users. Measured stimulus features, a TRIBE-shaped cortical encoder, and a click forecast with every coefficient printed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;450;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
