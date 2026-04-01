import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { PlayerProvider } from "@/components/player/PlayerContext";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";
import PersistentPlayer from "@/components/player/PersistentPlayer";
import { SidebarProvider } from "@/components/SidebarContext";
import Sidebar from "@/components/Sidebar";
import LayoutWrapper from "@/components/LayoutWrapper";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import Footer from "@/components/Footer";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

import { translations } from "@/lib/translations";
import { cookies } from "next/headers";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  return {
    title: {
      default: t.common.siteTitle,
      template: `%s | ${t.common.siteTitle}`,
    },
    description: t.home.description,
    keywords: ["VTuber", "歌枠", "YouTube", "歌ってみた", "V-uta", "Music Player"],
    authors: [{ name: "piniki" }],
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: '/',
      languages: {
        'ja-JP': '/ja',
        'en-US': '/en',
      },
    },
    openGraph: {
      title: t.common.siteTitle,
      description: t.home.description,
      url: baseUrl,
      siteName: t.common.siteTitle,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: [
        {
          url: '/logo-icon.png',
          width: 800,
          height: 800,
          alt: t.common.siteTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.common.siteTitle,
      description: t.home.description,
      images: ['/logo-icon.png'],
    },
    icons: {
      icon: '/icon.png',
      shortcut: '/favicon.ico',
      apple: '/apple-icon.png',
    },
  };
}

import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${outfit.variable} ${plusJakarta.variable} ${notoSansJP.variable}`}>
        <LocaleProvider>
          <ThemeProvider>
            <FavoritesProvider>
              <PlayerProvider>
                <SidebarProvider>
                  <Header />
                  <div className="app-layout mesh-bg">
                    <Sidebar />
                    <LayoutWrapper>
                      <main className="main-content">
                        <div className="flex-1">
                          {children}
                        </div>
                        <Footer />
                      </main>
                    </LayoutWrapper>
                  </div>
                  <MiniPlayer />
                  <FullPlayer />
                  <PersistentPlayer />
                </SidebarProvider>
              </PlayerProvider>
            </FavoritesProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
