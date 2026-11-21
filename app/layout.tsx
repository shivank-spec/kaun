import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { DesktopFrame } from "@/components/ui/DesktopFrame";
import "./globals.css";

const inter = Inter({ variable: "--f-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--f-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--f-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://playalibi.vercel.app"),
  title: "Alibi: find the culprit, hide your role",
  description:
    "A 3-minute AI mystery game set in Kolkata. Interrogate the suspects alone, or accuse your friends.",
  openGraph: {
    title: "Alibi",
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
        <Suspense fallback={null}>
          <DesktopFrame />
        </Suspense>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
