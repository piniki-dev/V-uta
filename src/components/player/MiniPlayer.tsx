'use client';

import { usePlayer } from './PlayerContext';
import { formatTime } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import FavoriteButton from '@/components/song/FavoriteButton';
import * as Slider from '@radix-ui/react-slider';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  Square, 
  Layout, 
  ChevronUp, 
  Maximize2, 
  Minimize2, 
  PictureInPicture,
  LayoutPanelLeft,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight
} from 'lucide-react';

export default function MiniPlayer() {
  const {
    state,
    pause,
    resume,
    toggleLoop,
    toggleMute,
    setVolume,
    nextSong,
    prevSong,
    seekTo,
    toggleFullPlayer,
    setPipPosition,
  } = usePlayer();
  const { t, T } = useLocale();

  if (!state.currentSong) return null;

  const duration = state.currentSong.endSec - state.currentSong.startSec;
  const progress = duration > 0 ? (state.currentTime / duration) * 100 : 0;

  return (
    <div className="mini-player">
      {/* シークバー（上部） */}
      <div className="mini-player__seekbar">
        <Slider.Root
          className="SliderRoot"
          value={[progress]}
          max={100}
          step={0.1}
          onValueChange={(val) => {
            const v = val[0];
            const seekSec = state.currentSong!.startSec + (v / 100) * duration;
            seekTo(seekSec);
          }}
        >
          <Slider.Track className="SliderTrack">
            <Slider.Range className="SliderRange" />
          </Slider.Track>
          <Slider.Thumb className="SliderThumb" aria-label="Seek" />
        </Slider.Root>
      </div>

      {/* メインコンテンツ */}
      <div className="mini-player__content">
        {/* 左: 曲情報 */}
        <div className="mini-player__info">
          {state.currentSong.thumbnailUrl && (
            <img
              src={state.currentSong.thumbnailUrl}
              alt=""
              className="mini-player__thumbnail"
            />
          ) || (
            <div className="mini-player__thumbnail-placeholder flex items-center justify-center bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-tertiary)]">♪</span>
            </div>
          )}
          <div className="mini-player__text">
            <div className="flex items-center gap-2">
              <span className="mini-player__title truncate max-w-[200px] md:max-w-[400px]">
                {t(state.currentSong.title, state.currentSong.title_en || state.currentSong.title)}
              </span>
              <FavoriteButton 
                songId={state.currentSong.id} 
                className="scale-90 opacity-60 hover:opacity-100 transition-opacity"
              />
            </div>
            <span className="mini-player__meta">
              {state.currentSong.channelName}
              {state.currentSong.videoTitle && (
                <span className="mini-player__video-title"> · {state.currentSong.videoTitle}</span>
              )}
            </span>
          </div>
        </div>

        {/* 中央: 再生コントロール */}
        <div className="mini-player__controls">
          <button
            onClick={prevSong}
            className="mini-player__btn"
            title={T('player.previous')}
            disabled={state.playlist.length <= 1}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={() => (state.isPlaying ? pause() : resume())}
            className="mini-player__btn mini-player__btn--play"
            title={state.isPlaying ? T('player.pause') : T('player.play')}
          >
            {state.isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={nextSong}
            className="mini-player__btn"
            title={T('player.next')}
            disabled={state.playlist.length <= 1}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* 右: サブコントロール */}
        <div className="mini-player__sub-controls">
          <span className="mini-player__time">
            {formatTime(state.currentTime)} / {formatTime(duration)}
          </span>

          <button
            onClick={toggleLoop}
            className={`mini-player__btn mini-player__btn--toggle ${state.isLooping ? 'active' : ''}`}
            title={state.isLooping ? T('player.loopOff') : T('player.loopOn')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
          </button>

          <button
            onClick={toggleMute}
            className="mini-player__btn"
            title={state.isMuted ? T('player.unmute') : T('player.mute')}
          >
            {state.isMuted || state.volume === 0 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          <Slider.Root
            className="VolumeSliderRoot"
            value={[state.isMuted ? 0 : state.volume]}
            max={100}
            step={1}
            onValueChange={(val) => setVolume(val[0])}
          >
            <Slider.Track className="VolumeSliderTrack">
              <Slider.Range className="VolumeSliderRange" />
            </Slider.Track>
            <Slider.Thumb className="VolumeSliderThumb" aria-label="Volume" />
          </Slider.Root>

          <div className="mini-player__divider" />

          {/* PiP 位置設定 (PiP中のみ表示) */}
          {!state.isFullPlayerOpen && (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button 
                  className="mini-player__btn" 
                  title={T('player.changePosition')}
                >
                  <PictureInPicture size={18} />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content className="pip-menu-content" sideOffset={10} align="end">
                  <DropdownMenu.Item 
                    className={`pip-menu-item ${state.pipPosition === 'top-left' ? 'active' : ''}`}
                    onSelect={() => setPipPosition('top-left')}
                  >
                    <ArrowUpLeft size={16} />
                    <span>{T('player.topLeft')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className={`pip-menu-item ${state.pipPosition === 'top-right' ? 'active' : ''}`}
                    onSelect={() => setPipPosition('top-right')}
                  >
                    <ArrowUpRight size={16} />
                    <span>{T('player.topRight')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className={`pip-menu-item ${state.pipPosition === 'bottom-left' ? 'active' : ''}`}
                    onSelect={() => setPipPosition('bottom-left')}
                  >
                    <ArrowDownLeft size={16} />
                    <span>{T('player.bottomLeft')}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className={`pip-menu-item ${state.pipPosition === 'bottom-right' ? 'active' : ''}`}
                    onSelect={() => setPipPosition('bottom-right')}
                  >
                    <ArrowDownRight size={16} />
                    <span>{T('player.bottomRight')}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* フルプレーヤートグル (1番右) */}
          <button
            onClick={toggleFullPlayer}
            className={`mini-player__btn ${state.isFullPlayerOpen ? 'active' : ''}`}
            title={state.isFullPlayerOpen ? T('player.closePlayer') : T('player.openPlayer')}
          >
            {state.isFullPlayerOpen ? (
              <Minimize2 size={20} />
            ) : (
              <Maximize2 size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
