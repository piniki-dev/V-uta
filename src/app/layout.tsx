import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { PlayerProvider } from "@/components/player/PlayerContext";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";

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
          <Header />
          <main className="main-content">{children}</main>
          <MiniPlayer />
          <FullPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
