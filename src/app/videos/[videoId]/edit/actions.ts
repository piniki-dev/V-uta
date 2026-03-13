'use server';

import { createClient } from '@/utils/supabase/server';
import { searchTracks, getHighResArtwork } from '@/lib/itunes';
import type { Song } from '@/types';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ===== iTunes 検索結果（再利用） =====
export interface ITunesSearchResult {
  trackId: number;
  title: string;
  artist: string;
  albumName: string;
  artworkUrl: string;
  durationSec: number;
}

/**
 * iTunes で曲を検索する（編集ページ用）
 */
export async function searchSongForEdit(
  query: string
): Promise<ActionResult<ITunesSearchResult[]>> {
  if (!query.trim()) {
    return { success: false, error: '検索キーワードを入力してください' };
  }

  try {
    const tracks = await searchTracks(query, 10);
    const results: ITunesSearchResult[] = tracks.map((t) => ({
      trackId: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      albumName: t.collectionName,
      artworkUrl: getHighResArtwork(t.artworkUrl100, 300),
      durationSec: Math.round((t.trackTimeMillis || 0) / 1000),
    }));
    return { success: true, data: results };
  } catch (e) {
    const message = e instanceof Error ? e.message : '曲の検索に失敗しました';
    return { success: false, error: message };
  }
}

/**
 * "mm:ss" 形式を秒に変換
 */
function parseTimeToSeconds(time: string): number | null {
  const match = time.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/**
 * 曲の区間情報を更新する
 */
export async function updateSong(input: {
  songId: number;
  startTime: string;
  endTime: string;
}): Promise<ActionResult<Song>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const startSec = parseTimeToSeconds(input.startTime);
  const endSec = parseTimeToSeconds(input.endTime);

  if (startSec === null) {
    return { success: false, error: '開始時間の形式が正しくありません（mm:ss）' };
  }
  if (endSec === null) {
    return { success: false, error: '終了時間の形式が正しくありません（mm:ss）' };
  }
  if (startSec >= endSec) {
    return { success: false, error: '終了時間は開始時間より後にしてください' };
  }
  if (endSec - startSec < 10) {
    return { success: false, error: '区間は10秒以上にしてください' };
  }

  const { data, error } = await supabase
    .from('songs')
    .update({
      start_sec: startSec,
      end_sec: endSec,
    })
    .eq('id', input.songId)
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `更新に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 曲の原曲情報を変更する（master_songs を UPSERT して songs.master_song_id を更新）
 */
export async function updateSongMaster(input: {
  songId: number;
  songTitle: string;
  songArtist: string;
  artworkUrl: string;
  itunesId: string;
  durationSec: number;
}): Promise<ActionResult<Song>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  // master_songs に UPSERT
  const { data: masterSong, error: masterError } = await supabase
    .from('master_songs')
    .upsert(
      {
        title: input.songTitle.trim(),
        artist: input.songArtist.trim() || 'Unknown',
        artwork_url: input.artworkUrl || null,
        itunes_id: input.itunesId ? String(input.itunesId) : null,
        duration_sec: input.durationSec > 0 ? input.durationSec : null,
      },
      { onConflict: 'title,artist' }
    )
    .select()
    .single();

  if (masterError) {
    return { success: false, error: `原曲情報の更新に失敗しました: ${masterError.message}` };
  }

  // songs の master_song_id を更新
  const { data, error } = await supabase
    .from('songs')
    .update({ master_song_id: masterSong.id })
    .eq('id', input.songId)
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `曲の更新に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 曲を削除する（論理削除: is_active = false）
 */
export async function deleteSong(
  songId: number
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  const { error } = await supabase
    .from('songs')
    .update({ is_active: false })
    .eq('id', songId);

  if (error) {
    return { success: false, error: `削除に失敗しました: ${error.message}` };
  }

  return { success: true, data: null };
}
