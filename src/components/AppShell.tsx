'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import LayoutWrapper from '@/components/LayoutWrapper';
import DynamicPlayer from '@/components/player/DynamicPlayer';
import Footer from '@/components/Footer';

export default function AppShell({
  children,
  isMaintenance = false,
}: {
  children: React.ReactNode;
  isMaintenance?: boolean;
}) {
  const pathname = usePathname();
  const isMaintenancePage = isMaintenance || pathname === '/maintenance';

  // メンテナンスページの場合はヘッダー・サイドバー・フッター・プレイヤーを非表示にして全画面表示
  if (isMaintenancePage) {
    return (
      <main className="min-h-screen w-full bg-slate-950 flex items-center justify-center">
        {children}
      </main>
    );
  }

  return (
    <>
      <Header />
      <div className="app-layout mesh-bg">
        <Sidebar />
        <LayoutWrapper>
          <main className="main-content">
            <div className="flex-1">{children}</div>
            <Footer />
          </main>
        </LayoutWrapper>
      </div>
      <DynamicPlayer />
    </>
  );
}
