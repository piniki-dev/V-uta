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
  const { state, setTime, pause, nextSong, stop, playerRef } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoopingRef = useRef(state.isLooping);
  const currentSongRef = useRef(state.currentSong);
  const nextSongRef = useRef(nextSong);
  const stopRef = useRef(stop);
  const setTimeRef = useRef(setTime);

  // 外部 API コールバックやタイマー用の最新状態保持
  useEffect(() => {
    isLoopingRef.current = state.isLooping;
    currentSongRef.current = state.currentSong;
  }, [state.isLooping, state.currentSong]);
 
  // コールバック関数は最新のものを保持
  useEffect(() => {
    nextSongRef.current = nextSong;
    stopRef.current = stop;
    setTimeRef.current = setTime;
  }, [nextSong, stop, setTime]);

  // YouTube Player の生成と維持
  useEffect(() => {
    // 曲がない場合は何もしないが、プレイヤー自体は一度作ったら維持する
    if (!state.currentSong && !playerRef.current) return;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!containerRef.current) return;

      // すでにプレイヤーが存在する場合は再生成しない
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        const song = state.currentSong;
        if (song) {
          playerRef.current.loadVideoById({
            videoId: song.videoId,
            startSeconds: song.startSec,
            endSeconds: song.endSec,
          });
          // 明示的に再生を開始（特にバックグラウンド対策）
          if (state.isPlaying) {
            playerRef.current.playVideo();
          }
        }
        return;
      }

      // プレイヤーが未生成、または壊れている場合は新規作成
      if (state.currentSong) {
        // コンテナをクリア
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player';
        containerRef.current.appendChild(playerDiv);

        new window.YT.Player('yt-player', {
          width: '100%',
          height: '100%',
          videoId: state.currentSong.videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            start: state.currentSong.startSec,
            end: state.currentSong.endSec,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              event.target.setVolume(state.volume);
              if (state.isMuted) event.target.mute();
              if (state.isPlaying) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                if (isLoopingRef.current && currentSongRef.current) {
                  // ループ: 区間先頭に戻す
                  event.target.seekTo(currentSongRef.current.startSec, true);
                  event.target.playVideo();
                } else {
                  nextSongRef.current();
                }
              }
            },
          },
        });
      }
    };

    initPlayer();

    // アンマウント時のみ破棄
    return () => {
      // ここでは何もしない (PersistentPlayer でラップされているため、
      // ページ遷移しても Player コンポーネント自体が生き残り、インスタンスを保持し続ける)
    };
  }, [state.currentSong?.id, state.currentSong?.videoId, state.playSessionKey, playerRef]);

  // 再生位置の定期追跡
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function' && 
          playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentSongRef.current) {
          // 区間終了を超えたらループ or 次曲
          if (currentTime >= currentSongRef.current.endSec) {
            if (isLoopingRef.current) {
              playerRef.current.seekTo(currentSongRef.current.startSec, true);
            } else {
              nextSongRef.current();
              return;
            }
          }
          // 現在の再生時間をセット（プログレスバー用）
          setTimeRef.current(Math.max(0, currentTime - currentSongRef.current.startSec));
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [playerRef]);

  // 再生/一時停止
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') return;
    if (state.isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [state.isPlaying, playerRef]);

  // 音量・ミュート変更
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.setVolume !== 'function') return;
    playerRef.current.setVolume(state.volume);
    if (state.isMuted) playerRef.current.mute();
    else playerRef.current.unMute();
  }, [state.volume, state.isMuted, playerRef]);

  if (!state.currentSong) return null;

  return (
    <div
      ref={containerRef}
      className="youtube-player-container"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
