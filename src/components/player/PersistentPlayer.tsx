'use client';

import { usePlayer } from './PlayerContext';
import YouTubePlayer from './YouTubePlayer';
import { useSidebar } from '@/components/SidebarContext';

export default function PersistentPlayer() {
  const { state } = usePlayer();
  const { isOpen: isSidebarOpen } = useSidebar();

  if (!state.currentSong) return null;

  return (
    <div 
      className={`video-window ${state.isFullPlayerOpen ? 'video-window--full' : 'video-window--pip'} ${isSidebarOpen ? 'sidebar-open' : ''}`}
      data-full={state.isFullPlayerOpen}
      data-pip-position={state.pipPosition}
      data-zoomed={state.isZoomed}
      data-video-ratio={state.videoRatio}
      data-video-ratio-mode={state.videoRatioMode}
    >
      <div className="video-window__inner">
        <YouTubePlayer />
      </div>
    </div>
  );
}
