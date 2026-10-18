import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import CloudKitProvider from "@/components/CloudKitProvider";
import { site } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-archivo", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "BoldFace — Aviation flashcards for checkrides and currency", template: "%s · BoldFace" },
  description: site.description,
  openGraph: {
    title: "BoldFace — Aviation flashcards",
    description: site.description,
    url: site.url,
    siteName: "BoldFace",
    images: ["/images/hero-photo.jpg"],
    type: "website",
  },
  other: { "apple-itunes-app": "app-id=6798727941" },
};

export const viewport: Viewport = { themeColor: "#0F1013" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <CloudKitProvider>
          <SiteNav />
          <main id="main">{children}</main>
          <SiteFooter />
        </CloudKitProvider>
      </body>
    </html>
  );
}
