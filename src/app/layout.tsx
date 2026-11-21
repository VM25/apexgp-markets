import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { AppShell } from "@/features/shell/AppShell";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ApexGP Markets — a Formula 1 prediction-market simulation", template: "%s · ApexGP Markets" },
  description:
    "Trade simulated event contracts on real, lap-by-lap replays of the 2025 Formula 1 season. Model-estimated probabilities, a simulated dealer market, and portfolio risk — with fictional capital only.",
  applicationName: "ApexGP Markets",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f3efe6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} ${newsreader.variable} antialiased`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
