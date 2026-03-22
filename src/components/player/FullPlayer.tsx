'use client';

import { usePlayer } from './PlayerContext';
import { formatTime } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

export default function FullPlayer() {
  const {
    state,
    play,
    seekTo,
  } = usePlayer();
  const { t, T } = useLocale();

  if (!state.currentSong) return null;

  const duration = state.currentSong.endSec - state.currentSong.startSec;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const seekSec = state.currentSong!.startSec + (value / 100) * duration;
    seekTo(seekSec);
  };

  return (
    <div className={`full-player ${state.isFullPlayerOpen ? 'open' : 'closed'}`}>
      <div className="full-player__body">
        {/* 左: YouTube プレイヤー (動画のみ) */}
        <div className="full-player__main">
          {/* PersistentPlayer will be positioned here when open */}
          <div className="full-player__video-placeholder" />
        </div>

        {/* 右: 再生リスト */}
        <div className="full-player__playlist">
          <h3 className="full-player__playlist-title">{T('player.queue')}</h3>
          <div className="full-player__playlist-list">
            {state.playlist.map((song, index) => (
              <button
                key={song.id}
                onClick={() => play(song, state.playlist)}
                className={`full-player__playlist-item ${
                  index === state.currentIndex ? 'active' : ''
                }`}
              >
                <span className="full-player__playlist-index">{index + 1}</span>
                 <div className="full-player__playlist-info">
                   <span className="full-player__playlist-song-title">
                     {t(song.title, song.title_en || song.title)}
                   </span>
                   <span className="full-player__playlist-song-artist">
                     {t(song.artist || '-', song.artist_en || song.artist || '-')}
                   </span>
                 </div>
                <span className="full-player__playlist-duration">
                  {formatTime(song.endSec - song.startSec)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
