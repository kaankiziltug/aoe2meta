import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aoe2meta.com"),
  title: {
    default: "AoE2Meta — Age of Empires II Statistics, Meta & Leaderboards",
    template: "%s | AoE2Meta",
  },
  description:
    "AoE2Meta: The ultimate Age of Empires II Definitive Edition stats tracker. Explore civilization win rates, tier lists, player rankings, leaderboards, and match history.",
  keywords: [
    "age of empires 2 stats",
    "aoe2 stats",
    "aoe2 leaderboard",
    "aoe2 civilization win rates",
    "age of empires 2 definitive edition statistics",
    "aoe2 meta",
    "aoe2 best civs",
    "aoe2 tier list",
    "age of empires 2 player stats",
    "aoe2 rank checker",
    "aoe2 elo",
    "aoe2 match history",
    "age of empires 2 leaderboard",
    "aoe2de stats",
  ],
  verification: {
    other: {
      "google-adsense-account": "ca-pub-9719471971523631",
    },
  },
  authors: [{ name: "AoE2Meta" }],
  creator: "AoE2Meta",
  publisher: "AoE2Meta",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aoe2meta.com",
    siteName: "AoE2Meta",
    title: "AoE2Meta — Age of Empires II Statistics, Meta & Leaderboards",
    description:
      "The ultimate Age of Empires II Definitive Edition stats tracker. Civilization win rates, player rankings, leaderboards, and match history.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "AoE2Meta — Age of Empires II Statistics & Meta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AoE2Meta — Age of Empires II Statistics & Meta",
    description:
      "The ultimate AoE2 stats tracker. Civilization win rates, player rankings, leaderboards.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://aoe2meta.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9719471971523631"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4FR9WLLZHM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4FR9WLLZHM');
          `}
        </Script>
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
