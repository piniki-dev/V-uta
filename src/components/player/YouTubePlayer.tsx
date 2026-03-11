'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from './PlayerContext';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiLoading = false;

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiLoaded) {
      resolve();
      return;
    }
    if (apiLoading) {
      const interval = setInterval(() => {
        if (apiLoaded) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    apiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
    };
  });
}

export default function YouTubePlayer() {
  const { state, setTime, pause, nextSong, playerRef } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoopingRef = useRef(state.isLooping);
  const currentSongRef = useRef(state.currentSong);

  // Refs を最新状態に同期
  useEffect(() => {
    isLoopingRef.current = state.isLooping;
  }, [state.isLooping]);

  useEffect(() => {
    currentSongRef.current = state.currentSong;
  }, [state.currentSong]);

  // YouTube Player 初期化
  useEffect(() => {
    if (!state.currentSong) return;

    let player: YT.Player | null = null;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!containerRef.current) return;

      // 既存プレイヤーを破棄
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // コンテナに div を追加
      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = 'yt-player';
      containerRef.current.appendChild(playerDiv);

      player = new window.YT.Player('yt-player', {
        width: '100%',
        height: '100%',
        videoId: state.currentSong!.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          start: state.currentSong!.startSec,
          end: state.currentSong!.endSec,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            event.target.setVolume(state.volume);
            if (state.isMuted) event.target.mute();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              if (isLoopingRef.current && currentSongRef.current) {
                // ループ: 区間先頭に戻す
                event.target.seekTo(currentSongRef.current.startSec, true);
                event.target.playVideo();
              } else {
                // 次の曲、またはプレイリストがない場合は停止
                nextSong();
              }
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // currentSong の id/videoId が変わった時のみ再初期化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong?.id, state.currentSong?.videoId]);

  // 再生位置の定期追跡
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state.isPlaying && state.currentSong) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current && currentSongRef.current) {
          const currentTime = playerRef.current.getCurrentTime();

          // 区間終了を超えたらループ or 次曲
          if (currentTime >= currentSongRef.current.endSec) {
            if (isLoopingRef.current) {
              playerRef.current.seekTo(currentSongRef.current.startSec, true);
            } else {
              nextSong();
              return;
            }
          }

          // currentTime を区間内相対値にして保存
          const relativeTime = currentTime - currentSongRef.current.startSec;
          setTime(Math.max(0, relativeTime));
        }
      }, 250);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.currentSong?.id]);

  // 再生/一時停止
  useEffect(() => {
    if (!playerRef.current) return;
    if (state.isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying]);

  // 音量変更
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(state.volume);
  }, [state.volume, playerRef]);

  // ミュート変更
  useEffect(() => {
    if (!playerRef.current) return;
    if (state.isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [state.isMuted, playerRef]);

  if (!state.currentSong) return null;

  return (
    <div
      ref={containerRef}
      className="youtube-player-container"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
