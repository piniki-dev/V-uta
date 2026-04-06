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

  // YouTube Player の生成と維持 (マウント時に一度だけ実行、またはプライバシーモード変更時)
  useEffect(() => {
    let isMounted = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!isMounted || !containerRef.current) return;

      // すでにプレイヤーが存在し、機能している場合は、ホスト（プライバシーモード）が同じなら再生成しない
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        const currentHost = playerRef.current.getIframe()?.src || '';
        const targetHost = state.isPrivacyMode ? 'youtube-nocookie.com' : 'youtube.com';
        if (currentHost.includes(targetHost)) return;
        
        // ホストが変わる場合は一度破棄
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.warn('[V-uta] Error destroying player for host change:', e);
        }
      }

      // コンテナをクリア
      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      containerRef.current.appendChild(playerDiv);

      const host = state.isPrivacyMode ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
      const songToInit = currentSongRef.current;
      
      try {
        new window.YT.Player(playerDiv, {
          host,
          width: '100%',
          height: '100%',
          videoId: songToInit?.videoId || '', 
          playerVars: {
            autoplay: songToInit ? 1 : 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            start: songToInit?.startSec || 0,
            end: songToInit?.endSec || 0,
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
              
              // 初回マウント時に曲があれば再生
              if (currentSongRef.current && isPlayingRef.current) {
                event.target.playVideo();
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PAUSED) {
                if (isPlayingRef.current) {
                  setTimeout(() => {
                    if (isMounted && isPlayingRef.current && playerRef.current?.getPlayerState() === window.YT.PlayerState.PAUSED) {
                      console.warn('[V-uta] Unexpected pause detected.');
                      // 自動復帰試行などのロジック
                    }
                  }, 1000);
                }
              }

              if (event.data === window.YT.PlayerState.ENDED) {
                if (isLoopingRef.current && currentSongRef.current) {
                  event.target.seekTo(currentSongRef.current.startSec, true);
                  event.target.playVideo();
                } else {
                  nextSongRef.current();
                }
              }
            },
            onError: (event) => {
              if (event.data === 101 || event.data === 150 || event.data === 5) {
                if (!state.isPrivacyMode) {
                  setPrivacyModeRef.current(true, false);
                  showToastRef.current(T_Ref.current('player.autoPrivacyModeMessage'), {
                    title: T_Ref.current('player.autoPrivacyModeTitle'),
                    type: 'privacy',
                    duration: Infinity,
                  });
                }
              }
            }
          },
        });
      } catch (e) {
        console.error('[V-uta] Failed to initialize YouTube Player:', e);
      }
    };

    initPlayer();

    return () => {
      isMounted = false;
    };
  }, [state.isPrivacyMode, playerRef]);

  // 曲変更への反応
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.loadVideoById !== 'function') return;
    const currentSong = currentSongRef.current;
    if (!currentSong) return;

    // 現在再生中の動画と同じであればロードし直さない（セッションキーが変わった場合のみ、またはIDが変わった場合）
    // ただし YouTube API の状態によっては loadVideoById を呼ぶ必要がある
    try {
      playerRef.current.loadVideoById({
        videoId: currentSong.videoId,
        startSeconds: currentSong.startSec,
        endSeconds: currentSong.endSec,
      });
      if (isPlayingRef.current) {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.error('[V-uta] Error in loadVideoById effect:', e);
    }
  }, [state.currentSong?.id, state.currentSong?.videoId, state.playSessionKey, playerRef]);

  // 再生位置の定期追跡
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function' && 
          playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentSongRef.current) {
          if (currentTime >= currentSongRef.current.endSec) {
            if (isLoopingRef.current) {
              playerRef.current.seekTo(currentSongRef.current.startSec, true);
            } else {
              nextSongRef.current();
              return;
            }
          }
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

  return (
    <div
      ref={containerRef}
      className="youtube-player-container"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
