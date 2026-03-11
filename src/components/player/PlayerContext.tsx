'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
import type { PlayerSong, PlayerState } from '@/types';

// ===== Actions =====

type PlayerAction =
  | { type: 'PLAY'; song: PlayerSong; playlist?: PlayerSong[] }
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
  | { type: 'CLOSE_FULL_PLAYER' };

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
      };
    }
    case 'TOGGLE_FULL_PLAYER':
      return { ...state, isFullPlayerOpen: !state.isFullPlayerOpen };
    case 'CLOSE_FULL_PLAYER':
      return { ...state, isFullPlayerOpen: false };
    default:
      return state;
  }
}

// ===== Context =====

interface PlayerContextType {
  state: PlayerState;
  play: (song: PlayerSong, playlist?: PlayerSong[]) => void;
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

  const play = useCallback((song: PlayerSong, playlist?: PlayerSong[]) => {
    dispatch({ type: 'PLAY', song, playlist });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE' });
    playerRef.current?.pauseVideo();
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'RESUME' });
    playerRef.current?.playVideo();
  }, []);

  const stop = useCallback(() => {
    dispatch({ type: 'STOP' });
    playerRef.current?.stopVideo();
  }, []);

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
    dispatch({ type: 'NEXT_SONG' });
  }, []);

  const prevSong = useCallback(() => {
    dispatch({ type: 'PREV_SONG' });
  }, []);

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

  return (
    <PlayerContext.Provider
      value={{
        state,
        play,
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
        playerRef,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
