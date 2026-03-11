'use client';

import { usePlayer } from './PlayerContext';
import { formatTime } from '@/lib/utils';
import * as Slider from '@radix-ui/react-slider';

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
  } = usePlayer();

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
          )}
          <div className="mini-player__text">
            <span className="mini-player__title">{state.currentSong.title}</span>
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
            title="前の曲"
            disabled={state.playlist.length <= 1}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={() => (state.isPlaying ? pause() : resume())}
            className="mini-player__btn mini-player__btn--play"
            title={state.isPlaying ? '一時停止' : '再生'}
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
            title="次の曲"
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
            title={state.isLooping ? 'ループ OFF' : 'ループ ON'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
            </svg>
          </button>

          <button
            onClick={toggleMute}
            className="mini-player__btn"
            title={state.isMuted ? 'ミュート解除' : 'ミュート'}
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

          {/* フルプレーヤートグル (1番右) */}
          <button
            onClick={toggleFullPlayer}
            className={`mini-player__btn ${state.isFullPlayerOpen ? 'active' : ''}`}
            title={state.isFullPlayerOpen ? '再生ページを閉じる' : '再生ページを開く'}
          >
            {state.isFullPlayerOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3l4 4h-3v7h-2V7H8l4-4zm0 18l-4-4h3v-7h2v7h3l-4 4z" transform="rotate(45 12 12)"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
