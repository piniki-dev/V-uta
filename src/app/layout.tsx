import { Outfit, Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { PlayerProvider } from "@/components/player/PlayerContext";
import { SidebarProvider } from "@/components/SidebarContext";
import Sidebar from "@/components/Sidebar";
import LayoutWrapper from "@/components/LayoutWrapper";
import DynamicPlayer from "@/components/player/DynamicPlayer";
import { ToastProvider } from "@/components/ToastProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import Footer from "@/components/Footer";
import { createClient } from "@/utils/supabase/server";
import { getPlaylists } from "@/app/playlists/actions";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
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
    },
    twitter: {
      card: 'summary_large_image',
      title: t.common.siteTitle,
      description: t.home.description,
    },
    icons: {
      icon: '/icon.png',
      shortcut: '/favicon.ico',
      apple: '/icon.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: t.common.siteTitle,
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport = {
  themeColor: '#0f0f0f',
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/LocaleProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const playlistsRes = await getPlaylists();
  const initialPlaylists = playlistsRes.success ? playlistsRes.data || [] : [];

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${outfit.variable} ${plusJakarta.variable} ${notoSansJP.variable}`}>
        <LocaleProvider initialLocale={locale}>
          <ThemeProvider>
            <FavoritesProvider>
              <PlayerProvider>
                <ToastProvider>
                  <SidebarProvider>
                    <Header />
                    <div className="app-layout mesh-bg">
                      <Sidebar initialUser={user} initialPlaylists={initialPlaylists} />
                      <LayoutWrapper>
                        <main className="main-content">
                          <div className="flex-1">
                            {children}
                          </div>
                          <Footer />
                        </main>
                      </LayoutWrapper>
                    </div>
                    <DynamicPlayer />
                  </SidebarProvider>
                </ToastProvider>
              </PlayerProvider>
            </FavoritesProvider>
          </ThemeProvider>
        </LocaleProvider>
        <Analytics />
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
