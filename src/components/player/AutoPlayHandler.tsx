'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from './PlayerContext';
import { useLocale } from '@/components/LocaleProvider';
import type { PlayerSong, Song, Video } from '@/types';

interface Props {
  songId?: string | null;
  video: Video;
  songs: Song[];
}

/**
 * URLパラメータに songId が指定されている場合に、その曲を自動再生するハンドラー
 */
export default function AutoPlayHandler({ songId, video, songs }: Props) {
  const { playWithSource } = usePlayer();
  const { T } = useLocale();
  const hasAutoPlayed = useRef(false);

  // Song -> PlayerSong への変換ロジック
  const toPlayerSong = useCallback((song: Song): PlayerSong => ({
    id: song.id,
    title: song.master_songs?.title || T('common.unknown'),
    artist: song.master_songs?.artist || null,
    title_en: song.master_songs?.title_en || null,
    artist_en: song.master_songs?.artist_en || null,
    artworkUrl: song.master_songs?.artwork_url || null,
    videoId: video.video_id,
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: video.channels?.name || T('common.unknown'),
    channelThumbnailUrl: video.channels?.image || null,
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  }), [T, video.channels?.image, video.channels?.name, video.thumbnail_url, video.title, video.video_id]);

  useEffect(() => {
    // すでに自動再生したか、songId がない場合は何もしない
    if (!songId || hasAutoPlayed.current || songs.length === 0) return;

    console.log('[AutoPlay] songId detected:', songId);
    
    // songId は文字列、s.id は数値（またはUUID文字列）の場合があるため比較を柔軟に
    const targetSong = songs.find(s => String(s.id) === String(songId));
    
    if (targetSong) {
      console.log('[AutoPlay] target song found:', targetSong.master_songs?.title);
      const playerSong = toPlayerSong(targetSong);
      const playerSongs = songs.map(toPlayerSong);
      
      // コンテキストの初期化を考慮して少し待つ
      const timer = setTimeout(() => {
        if (hasAutoPlayed.current) return;
        
        console.log('[AutoPlay] Executing playWithSource:', playerSong.title);
        playWithSource(playerSong, playerSongs, 'video', video.video_id);
        
        // 実行に成功したらフラグを立てる
        hasAutoPlayed.current = true;
      }, 500); // 500ms に少し戻して安定性を確保

      return () => {
        console.log('[AutoPlay] Cleaning up timer');
        clearTimeout(timer);
      };
    } else {
      console.warn('[AutoPlay] target song not found in list. songId:', songId);
    }
  }, [songId, video.video_id, songs, playWithSource, toPlayerSong]);

  return null;
}
