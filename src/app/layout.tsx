import type { Metadata } from "next";
import { Inter, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"], weight: "400", style: ["normal", "italic"],
  variable: "--font-serif", display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://precog-tau.vercel.app"),
  title: "Precog — see the click before you ship the page",
  description:
    "Precog measures the real pixels and the real copy of a landing page, encodes a predicted cortical response across six networks, and forecasts click-through with every coefficient printed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
