import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--f-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--f-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--f-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://playkaun.vercel.app"),
  title: "Kaun? Find the culprit. Hide your role.",
  description:
    "A 3-minute AI mystery game set in Kolkata. Interrogate the suspects alone, or accuse your friends.",
  openGraph: {
    title: "Kaun?",
    description: "Find the culprit. Hide your role. A new mystery every 3 minutes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060A14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        <div className="backdrop" aria-hidden="true" />
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
