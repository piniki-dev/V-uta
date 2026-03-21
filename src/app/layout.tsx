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

export const metadata: Metadata = {
  title: "V-uta | VTuber 歌枠プレイヤー",
  description:
    "VTuber の YouTube 歌枠アーカイブから歌っている区間だけを再生できる音楽ストリーミング風 Web アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable}`}>
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
      </body>
    </html>
  );
}
