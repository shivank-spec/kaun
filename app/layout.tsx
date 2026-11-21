import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Special_Elite } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", weight: "400", subsets: ["latin"] });
const typewriter = Special_Elite({ variable: "--font-type", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kaun? A new mystery every 3 minutes",
  description:
    "A 3-minute AI mystery game set in Kolkata. Interrogate the suspects alone, or accuse your friends.",
  openGraph: { title: "Kaun?", description: "A new mystery every 3 minutes.", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0E0C0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} ${typewriter.variable}`}>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
