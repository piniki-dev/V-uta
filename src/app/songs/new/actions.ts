'use server';

import { createClient } from '@/utils/supabase/server';
import { extractVideoId, fetchVideoMetadata } from '@/lib/youtube';
import { searchTracks as itunesSearch, getHighResArtwork } from '@/lib/itunes';
import type { Video, Song, YouTubeVideoMetadata } from '@/types';

// ===== 時刻ユーティリティ =====

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

// ===== レスポンス型 =====

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ===== iTunes 検索結果の型（クライアントに返す用） =====

export interface ITunesSearchResult {
  trackId: number;
  title: string;
  artist: string;
  albumName: string;
  artworkUrl: string; // 高解像度に変換済み
  durationSec: number; // 曲の長さ（秒）
}

// ===== Server Actions =====

/**
 * iTunes Search API で曲を検索する
 */
export async function searchSongAction(
  query: string
): Promise<ActionResult<ITunesSearchResult[]>> {
  if (!query.trim()) {
    return { success: false, error: '検索キーワードを入力してください' };
  }

  try {
    const tracks = await itunesSearch(query, 10);
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
 * YouTube URL からメタデータを取得してプレビュー表示用に返す
 */
export async function fetchVideoPreview(
  url: string
): Promise<ActionResult<YouTubeVideoMetadata>> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return { success: false, error: '有効な YouTube URL を入力してください' };
  }

  try {
    const metadata = await fetchVideoMetadata(videoId);
    if (!metadata) {
      return { success: false, error: '動画が見つかりません' };
    }
    return { success: true, data: metadata };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'メタデータの取得に失敗しました';
    return { success: false, error: message };
  }
}

/**
 * 動画を videos テーブルに登録（既に存在する場合はそのまま返す）
 */
export async function registerVideo(
  metadata: YouTubeVideoMetadata
): Promise<ActionResult<Video>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  // 既存チェック
  const { data: existing } = await supabase
    .from('videos')
    .select('*')
    .eq('video_id', metadata.videoId)
    .single();

  if (existing) {
    return { success: true, data: existing as Video };
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      video_id: metadata.videoId,
      title: metadata.title,
      channel_id: metadata.channelId,
      channel_name: metadata.channelName,
      thumbnail_url: metadata.thumbnailUrl,
      published_at: metadata.publishedAt,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `動画の登録に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Video };
}

/**
 * 歌（曲の区間）を songs テーブルに登録
 * master_songs テーブルに原曲情報を UPSERT し、その ID を songs に紐付ける
 */
export async function registerSong(input: {
  videoDbId: number;
  songTitle: string;
  songArtist: string;
  artworkUrl: string;
  itunesId: string;
  durationSec: number;
  startTime: string;
  endTime: string;
}): Promise<ActionResult<Song>> {
  // バリデーション
  if (!input.songTitle.trim()) {
    return { success: false, error: '曲を選択してください' };
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

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  // master_songs に UPSERT（曲名+アーティスト名で名寄せ）
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
      {
        onConflict: 'title,artist',
      }
    )
    .select()
    .single();

  if (masterError) {
    return { success: false, error: `原曲情報の登録に失敗しました: ${masterError.message}` };
  }

  // songs テーブルに INSERT
  const { data, error } = await supabase
    .from('songs')
    .insert({
      video_id: input.videoDbId,
      master_song_id: masterSong.id,
      start_sec: startSec,
      end_sec: endSec,
      created_by: user.id,
    })
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `曲の登録に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Song };
}
