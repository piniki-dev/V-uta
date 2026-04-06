'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerContext';
import { useToast } from '../ToastProvider';
import { useLocale } from '@/components/LocaleProvider';

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
    
    // 安全なスクリプト挿入
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      (document.head || document.body).appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
    };
  });
}

export default function YouTubePlayer() {
  const { state, setTime, nextSong, stop, playerRef, setPrivacyMode } = usePlayer();
  const { showToast } = useToast();
  const { T } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(state.isPlaying);
  const isLoopingRef = useRef(state.isLooping);
  const currentSongRef = useRef(state.currentSong);
  const nextSongRef = useRef(nextSong);
  const stopRef = useRef(stop);
  const setTimeRef = useRef(setTime);
  const setPrivacyModeRef = useRef(setPrivacyMode);
  const showToastRef = useRef(showToast);
  const T_Ref = useRef(T);
  const volumeRef = useRef(state.volume);
  const isMutedRef = useRef(state.isMuted);

  // 外部 API コールバックやタイマー用の最新状態保持
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
    isLoopingRef.current = state.isLooping;
    currentSongRef.current = state.currentSong;
    volumeRef.current = state.volume;
    isMutedRef.current = state.isMuted;
  }, [state.isPlaying, state.isLooping, state.currentSong, state.volume, state.isMuted]);
 
  // コールバック関数は最新のものを保持
  useEffect(() => {
    nextSongRef.current = nextSong;
    stopRef.current = stop;
    setTimeRef.current = setTime;
    setPrivacyModeRef.current = setPrivacyMode;
    showToastRef.current = showToast;
    T_Ref.current = T;
  }, [nextSong, stop, setTime, setPrivacyMode, showToast, T]);

  // YouTube Player の生成と維持
  useEffect(() => {
    let isMounted = true;

    // 曲がない場合は何もしないが、プレイヤー自体は一度作ったら維持する
    const currentSong = currentSongRef.current;
    if (!currentSong && !playerRef.current) return;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!isMounted || !containerRef.current) return;

      // すでにプレイヤーが存在し、機能している場合は再生成しない
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        const song = currentSongRef.current;
        if (song) {
          try {
            playerRef.current.loadVideoById({
              videoId: song.videoId,
              startSeconds: song.startSec,
              endSeconds: song.endSec,
            });
            // 明示的に再生を開始（特にバックグラウンド対策）
            if (isPlayingRef.current) {
              playerRef.current.playVideo();
            }
          } catch (e) {
            console.error('[V-uta] Failed to load video into existing player:', e);
          }
        }
        return;
      }

      // プレイヤーが未生成、または壊れている場合は新規作成
      const songToInit = currentSongRef.current;
      if (songToInit) {
        // コンテナをクリア
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        containerRef.current.appendChild(playerDiv);

        const host = state.isPrivacyMode ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
        
        try {
          // 文字列 ID ではなく、DOM 要素を直接渡す (b.parentNode エラー対策)
          new window.YT.Player(playerDiv, {
            host,
            width: '100%',
            height: '100%',
            videoId: songToInit.videoId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              rel: 0,
              start: songToInit.startSec,
              end: songToInit.endSec,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (!isMounted) {
                  event.target.destroy();
                  return;
                }
                playerRef.current = event.target;
                event.target.setVolume(volumeRef.current);
                if (isMutedRef.current) event.target.mute();
                if (isPlayingRef.current) event.target.playVideo();
              },
              onStateChange: (event) => {
                if (event.data === window.YT.PlayerState.PAUSED) {
                  // 再生中のはずなのに停止した場合（同時再生制限などの可能性）
                  if (isPlayingRef.current) {
                    // 1秒待っても停止したままならプライバシーモードに切り替えて再起動
                    setTimeout(() => {
                      if (isMounted && isPlayingRef.current && playerRef.current?.getPlayerState() === window.YT.PlayerState.PAUSED) {
                        console.warn('[V-uta] Unexpected pause detected. Auto-switching to Privacy Mode to resume playback.');
                        setPrivacyModeRef.current(true, false);
                        showToastRef.current(T_Ref.current('player.autoPrivacyModeMessage'), {
                          title: T_Ref.current('player.autoPrivacyModeTitle'),
                          type: 'privacy',
                          duration: Infinity,
                        });
                      }
                    }, 1000);
                  }
                }

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
              onError: (event) => {
                // エラーコード 101/150 (埋め込み禁止、または同時再生制限) の場合はプライバシーモードでリトライ
                if (event.data === 101 || event.data === 150 || event.data === 5) {
                  if (!state.isPrivacyMode) {
                    console.warn(`[V-uta] Player error (${event.data}) detected. Retrying with Privacy Mode...`);
                    setPrivacyModeRef.current(true, false);
                    showToastRef.current(T_Ref.current('player.autoPrivacyModeMessage'), {
                      title: T_Ref.current('player.autoPrivacyModeTitle'),
                      type: 'privacy',
                      duration: Infinity,
                    });
                  }
                } else {
                  console.error(`[V-uta] YouTube Player Error: ${event.data}`);
                }
              }
            },
          });
        } catch (e) {
          console.error('[V-uta] Failed to initialize YouTube Player:', e);
        }
      }
    };

    initPlayer();

    // クリーンアップ
    return () => {
      isMounted = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.error('[V-uta] Error during player destruction:', e);
        }
      }
    };
  }, [state.currentSong?.id, state.currentSong?.videoId, state.playSessionKey, state.isPrivacyMode, playerRef]);

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
