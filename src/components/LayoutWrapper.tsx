'use client';

import { useSidebar } from './SidebarContext';
import { usePlayer } from './player/PlayerContext';
import { ReactNode, useState, useEffect } from 'react';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();
  const { state } = usePlayer();
  const hasPlayer = !!state.currentSong;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // 初期描画（0ms）はトランジション無効にするため、マウント後 100ms 遅延させて有効化する
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`layout-content ${isOpen ? 'sidebar-toggled' : ''} ${hasPlayer ? 'has-player' : ''} ${isMounted ? 'is-ready' : ''}`}>
      {children}
    </div>
  );
}
