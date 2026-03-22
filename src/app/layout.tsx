import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { PlayerProvider } from "@/components/player/PlayerContext";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";
import PersistentPlayer from "@/components/player/PersistentPlayer";
import { SidebarProvider } from "@/components/SidebarContext";
import Sidebar from "@/components/Sidebar";
import LayoutWrapper from "@/components/LayoutWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { translations } from "@/lib/translations";
import { cookies } from "next/headers";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.common.siteTitle} | ${t.home.title}`,
    description: t.home.description,
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
      <body className={`${inter.variable}`}>
        <LocaleProvider>
          <ThemeProvider>
            <PlayerProvider>
              <SidebarProvider>
                <Header />
                <div className="app-layout">
                  <Sidebar />
                  <LayoutWrapper>
                    <main className="main-content">{children}</main>
                  </LayoutWrapper>
                </div>
                <MiniPlayer />
                <FullPlayer />
                <PersistentPlayer />
              </SidebarProvider>
            </PlayerProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
