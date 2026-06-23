import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Space_Mono } from "next/font/google";
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import localFont from 'next/font/local';
import { cn } from "@/lib/utils";

const fableNoir = localFont({
  src: './fonts/FableNoir.otf',
  variable: '--font-fable-noir',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hau Hau Cafe",
  description: "Your escape from the heat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(dmSans.variable, playfair.variable, spaceMono.variable, fableNoir.variable)}>
      <body className="antialiased min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
        {children}
      </body>
    </html>
  );
}
