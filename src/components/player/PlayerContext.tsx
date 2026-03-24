'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { PlayerSong, PlayerState, PipPosition } from '@/types';
import { recordPlayHistory, updatePlayDuration } from '@/app/history/actions';

// ===== Actions =====

type PlayerAction =
  | { type: 'PLAY'; song: PlayerSong; playlist?: PlayerSong[]; sourceType?: string; sourceId?: string }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'SET_TIME'; time: number }
  | { type: 'TOGGLE_LOOP' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'NEXT_SONG' }
  | { type: 'PREV_SONG' }
  | { type: 'TOGGLE_FULL_PLAYER' }
  | { type: 'CLOSE_FULL_PLAYER' }
  | { type: 'SET_HISTORY_ID'; id: number | null }
  | { type: 'ADD_SONG_NEXT'; song: PlayerSong }
  | { type: 'ADD_SONG_LAST'; song: PlayerSong }
  | { type: 'SET_PIP_POSITION'; position: PipPosition }
  | { type: 'TOGGLE_ZOOM' }
  | { type: 'SET_VIDEO_RATIO'; ratio: string }
  | { type: 'SET_VIDEO_RATIO_MODE'; mode: 'auto' | '16/9' | '9/16' };

// ===== Reducer =====

const initialState: PlayerState = {
  currentSong: null,
  playlist: [],
  currentIndex: -1,
  isPlaying: false,
  isLooping: false,
  volume: 80,
  isMuted: false,
  currentTime: 0,
  isFullPlayerOpen: false,
  sourceType: null,
  sourceId: null,
  currentHistoryId: null,
  playSessionKey: 0, // 再生セッションを一意に識別
  pipPosition: 'bottom-right',
  isZoomed: false,
  videoRatio: '16/9',
  videoRatioMode: 'auto',
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY': {
      const playlist = action.playlist || [action.song];
      const index = playlist.findIndex((s) => s.id === action.song.id);
      return {
        ...state,
        currentSong: action.song,
        playlist,
        currentIndex: index >= 0 ? index : 0,
        isPlaying: true,
        currentTime: 0,
        isFullPlayerOpen: true, // 再生時に自動でフルプレイヤーを表示
        sourceType: action.sourceType || 'direct',
        sourceId: action.sourceId || null,
        currentHistoryId: null,
        playSessionKey: state.playSessionKey + 1,
      };
    }
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'RESUME':
      return { ...state, isPlaying: true };
    case 'STOP':
      return { ...initialState, volume: state.volume, isMuted: state.isMuted, isLooping: state.isLooping };
    case 'SET_TIME':
      return { ...state, currentTime: action.time };
    case 'TOGGLE_LOOP':
      return { ...state, isLooping: !state.isLooping };
    case 'SET_VOLUME':
      return { ...state, volume: action.volume, isMuted: action.volume === 0 };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'NEXT_SONG': {
      if (state.playlist.length === 0) return state;
      const nextIndex = (state.currentIndex + 1) % state.playlist.length;
      return {
        ...state,
        currentSong: state.playlist[nextIndex],
        currentIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
        currentHistoryId: null,
        playSessionKey: state.playSessionKey + 1,
      };
    }
    case 'PREV_SONG': {
      if (state.playlist.length === 0) return state;
      const prevIndex =
        state.currentIndex <= 0
          ? state.playlist.length - 1
          : state.currentIndex - 1;
      return {
        ...state,
        currentSong: state.playlist[prevIndex],
        currentIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
        currentHistoryId: null,
        playSessionKey: state.playSessionKey + 1,
      };
    }
    case 'TOGGLE_FULL_PLAYER':
      return { ...state, isFullPlayerOpen: !state.isFullPlayerOpen };
    case 'CLOSE_FULL_PLAYER':
      return { ...state, isFullPlayerOpen: false };
    case 'SET_HISTORY_ID':
      return { ...state, currentHistoryId: action.id };
    case 'ADD_SONG_NEXT': {
      const newPlaylist = [...state.playlist];
      if (state.currentIndex === -1) {
        // 再生リストが空なら先頭に追加
        return {
          ...state,
          playlist: [action.song],
          currentIndex: 0,
          currentSong: action.song,
          isPlaying: true, // 自動再生
          playSessionKey: state.playSessionKey + 1,
        };
      }
      newPlaylist.splice(state.currentIndex + 1, 0, action.song);
      return { ...state, playlist: newPlaylist };
    }
    case 'ADD_SONG_LAST': {
      const newPlaylist = [...state.playlist, action.song];
      if (state.currentIndex === -1) {
        // 再生リストが空なら先頭に追加
        return {
          ...state,
          playlist: [action.song],
          currentIndex: 0,
          currentSong: action.song,
          isPlaying: true, // 自動再生
          playSessionKey: state.playSessionKey + 1,
        };
      }
      return { ...state, playlist: newPlaylist };
    }
    case 'SET_PIP_POSITION':
      return { ...state, pipPosition: action.position };
    case 'TOGGLE_ZOOM':
      return { ...state, isZoomed: !state.isZoomed };
    case 'SET_VIDEO_RATIO':
      return { ...state, videoRatio: action.ratio };
    case 'SET_VIDEO_RATIO_MODE':
      return { ...state, videoRatioMode: action.mode, videoRatio: action.mode === 'auto' ? state.videoRatio : action.mode };
    default:
      return state;
  }
}

// ===== Context =====

interface PlayerContextType {
  state: PlayerState;
  play: (song: PlayerSong, playlist?: PlayerSong[]) => void;
  playWithSource: (song: PlayerSong, playlist?: PlayerSong[], sourceType?: string, sourceId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setTime: (time: number) => void;
  toggleLoop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleFullPlayer: () => void;
  closeFullPlayer: () => void;
  seekTo: (seconds: number) => void;
  addSongNext: (song: PlayerSong) => void;
  addSongLast: (song: PlayerSong) => void;
  setPipPosition: (position: PipPosition) => void;
  toggleZoom: () => void;
  setVideoRatioMode: (mode: 'auto' | '16/9' | '9/16') => void;
  playerRef: React.MutableRefObject<YT.Player | null>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer は PlayerProvider 内で使用してください');
  }
  return context;
}

// ===== Provider =====

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const playerRef = useRef<YT.Player | null>(null);

  // 自動アスペクト比検出
  useEffect(() => {
    if (state.videoRatioMode !== 'auto' || !state.currentSong) return;

    const fetchDimensions = async () => {
      try {
        const videoId = state.currentSong?.videoId;
        if (!videoId) return;

        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const data = await response.json();

        let newRatio = '16/9';
        if (data.width && data.height) {
          const ratio = data.width / data.height;
          if (ratio < 1.0) newRatio = '9/16';
        }

        // oEmbed が 16:9 を返していても、タイトルに縦型を示唆するキーワードがあれば 9/16 とする
        const videoTitle = state.currentSong?.videoTitle || "";
        if (newRatio === '16/9' && /縦|short|vertical/i.test(videoTitle)) {
          newRatio = '9/16';
        }

        dispatch({ type: 'SET_VIDEO_RATIO', ratio: newRatio });
      } catch (e) {
        console.error('Error fetching video dimensions:', e);
      }
    };

    fetchDimensions();
  }, [state.currentSong?.videoId, state.videoRatioMode]);

  // 累積再生時間の追跡
  const accumulatedTimeRef = useRef(0);
  const playStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: any;
    if (state.isPlaying) {
      playStartTimeRef.current = performance.now();
      interval = setInterval(() => {
        if (playStartTimeRef.current) {
          const now = performance.now();
          const delta = (now - playStartTimeRef.current) / 1000;
          accumulatedTimeRef.current += delta;
          playStartTimeRef.current = now;
        }
      }, 1000);
    } else {
      playStartTimeRef.current = null;
    }
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  // ヘルパー: 再生完了情報の計算
  const getPlaybackMetrics = useCallback(() => {
    if (!state.currentSong) return { playDuration: 0, lastPosition: 0, completionRate: 0, isCompleted: false };

    const duration = state.currentSong.endSec - state.currentSong.startSec;
    const accumulated = Math.floor(accumulatedTimeRef.current);
    const rate = Math.min(1, accumulated / duration);

    return {
      playDuration: accumulated,
      lastPosition: Math.floor(state.currentTime),
      completionRate: parseFloat(rate.toFixed(4)),
      isCompleted: rate >= 0.9
    };
  }, [state.currentSong, state.currentTime]);

  // 再生履歴の自動記録
  const currentSessionKeyRef = useRef<number>(0);
  const lastRecordedSessionKey = useRef<number>(-1);

  useEffect(() => {
    currentSessionKeyRef.current = state.playSessionKey;
  }, [state.playSessionKey]);

  useEffect(() => {
    if (state.currentSong && state.playSessionKey !== lastRecordedSessionKey.current) {
      const songId = state.currentSong.id;
      const sessionKey = state.playSessionKey;
      lastRecordedSessionKey.current = sessionKey;

      // 新しい再生が始まったら累積時間をリセット
      accumulatedTimeRef.current = 0;
      if (state.isPlaying) playStartTimeRef.current = performance.now();

      const record = async () => {
        const result = await recordPlayHistory({
          songId,
          sourceType: state.sourceType || 'direct',
          sourceId: state.sourceId || undefined,
        });

        // 非同期処理中にセッションが変わっていないか確認
        if (result.success && result.id && sessionKey === currentSessionKeyRef.current) {
          dispatch({ type: 'SET_HISTORY_ID', id: result.id });
        }
      };
      record();
    }
  }, [state.currentSong, state.playSessionKey, state.sourceType, state.sourceId, state.isPlaying]);

  // アンマウント時のみ最終再生時間を保存
  const latestHistoryIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef(0);

  useEffect(() => {
    latestHistoryIdRef.current = state.currentHistoryId;
  }, [state.currentHistoryId]);

  useEffect(() => {
    lastPositionRef.current = state.currentTime;
  }, [state.currentTime]);

  useEffect(() => {
    return () => {
      if (latestHistoryIdRef.current) {
        updatePlayDuration({
          historyId: latestHistoryIdRef.current,
          playDuration: Math.floor(accumulatedTimeRef.current),
          lastPosition: Math.floor(lastPositionRef.current),
        });
      }
    };
  }, []);

  const play = useCallback((song: PlayerSong, playlist?: PlayerSong[]) => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    // 再生リストが現在のものと同じ場合はソース情報を引き継ぐ
    const isContinuingContext = playlist && state.playlist &&
      playlist.length === state.playlist.length &&
      playlist.every((s, i) => s.id === state.playlist[i].id);

    dispatch({
      type: 'PLAY',
      song,
      playlist,
      sourceType: isContinuingContext ? (state.sourceType || undefined) : undefined,
      sourceId: isContinuingContext ? (state.sourceId || undefined) : undefined
    });
  }, [state.currentHistoryId, state.playlist, state.sourceType, state.sourceId, getPlaybackMetrics]);

  const playWithSource = useCallback((song: PlayerSong, playlist?: PlayerSong[], sourceType?: string, sourceId?: string) => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    dispatch({ type: 'PLAY', song, playlist, sourceType, sourceId });
  }, [state.currentHistoryId, getPlaybackMetrics]);

  const pause = useCallback(() => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    dispatch({ type: 'PAUSE' });
    playerRef.current?.pauseVideo();
  }, [state.currentHistoryId, getPlaybackMetrics]);

  const resume = useCallback(() => {
    dispatch({ type: 'RESUME' });
    playerRef.current?.playVideo();
  }, []);

  const stop = useCallback(() => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    dispatch({ type: 'STOP' });
    playerRef.current?.stopVideo();
  }, [state.currentHistoryId, getPlaybackMetrics]);

  const setTime = useCallback((time: number) => {
    dispatch({ type: 'SET_TIME', time });
  }, []);

  const toggleLoop = useCallback(() => {
    dispatch({ type: 'TOGGLE_LOOP' });
  }, []);

  const setVolume = useCallback((volume: number) => {
    dispatch({ type: 'SET_VOLUME', volume });
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
      if (volume > 0) playerRef.current.unMute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
    if (playerRef.current) {
      if (playerRef.current.isMuted()) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
    }
  }, []);

  const nextSong = useCallback(() => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    dispatch({ type: 'NEXT_SONG' });
  }, [state.currentHistoryId, getPlaybackMetrics]);

  const prevSong = useCallback(() => {
    if (state.currentHistoryId) {
      updatePlayDuration({
        historyId: state.currentHistoryId,
        ...getPlaybackMetrics()
      });
    }
    dispatch({ type: 'PREV_SONG' });
  }, [state.currentHistoryId, getPlaybackMetrics]);

  const toggleFullPlayer = useCallback(() => {
    dispatch({ type: 'TOGGLE_FULL_PLAYER' });
  }, []);

  const closeFullPlayer = useCallback(() => {
    dispatch({ type: 'CLOSE_FULL_PLAYER' });
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
      if (state.currentSong) {
        dispatch({ type: 'SET_TIME', time: Math.max(0, seconds - state.currentSong.startSec) });
      }
    }
  }, [state.currentSong]);

  const addSongNext = useCallback((song: PlayerSong) => {
    dispatch({ type: 'ADD_SONG_NEXT', song });
  }, []);

  const addSongLast = useCallback((song: PlayerSong) => {
    dispatch({ type: 'ADD_SONG_LAST', song });
  }, []);

  const setPipPosition = useCallback((position: PipPosition) => {
    dispatch({ type: 'SET_PIP_POSITION', position });
  }, []);

  const toggleZoom = useCallback(() => {
    dispatch({ type: 'TOGGLE_ZOOM' });
  }, []);

  const setVideoRatioMode = useCallback((mode: 'auto' | '16/9' | '9/16') => {
    dispatch({ type: 'SET_VIDEO_RATIO_MODE', mode });
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        state,
        play,
        playWithSource,
        pause,
        resume,
        stop,
        setTime,
        toggleLoop,
        setVolume,
        toggleMute,
        nextSong,
        prevSong,
        toggleFullPlayer,
        closeFullPlayer,
        seekTo,
        addSongNext,
        addSongLast,
        setPipPosition,
        toggleZoom,
        setVideoRatioMode,
        playerRef,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
