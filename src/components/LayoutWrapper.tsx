'use client';

import { useSidebar } from './SidebarContext';
import { usePlayer } from './player/PlayerContext';
import { ReactNode } from 'react';

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();
  const { state } = usePlayer();
  const hasPlayer = !!state.currentSong;

  return (
    <div className={`layout-content ${isOpen ? 'sidebar-open' : ''} ${hasPlayer ? 'has-player' : ''}`}>
      {children}
      <style jsx>{`
        .layout-content {
          flex: 1;
          width: 100%;
          transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding-bottom 0.3s ease;
          min-width: 0;
        }

        .layout-content.has-player {
          padding-bottom: calc(var(--player-height) + 16px);
        }

        @media (min-width: 769px) {
          .layout-content.sidebar-open {
            padding-left: var(--sidebar-width);
          }
        }
      `}</style>
    </div>
  );
}
