'use client';

import { usePlayer } from './PlayerContext';
import YouTubePlayer from './YouTubePlayer';

export default function PersistentPlayer() {
  const { state } = usePlayer();

  if (!state.currentSong) return null;

  return (
    <div 
      className={`video-window ${state.isFullPlayerOpen ? 'video-window--full' : 'video-window--pip'}`}
      data-full={state.isFullPlayerOpen}
      data-pip-position={state.pipPosition}
    >
      <div className="video-window__inner">
        <YouTubePlayer />
      </div>
    </div>
  );
}
