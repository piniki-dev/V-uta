'use server';

import { createClient } from '@/utils/supabase/server';
import { extractVideoId, fetchVideoMetadata } from '@/lib/youtube';
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

// ===== Server Actions =====

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
 */
export async function registerSong(input: {
  videoDbId: number;
  title: string;
  artist: string;
  startTime: string;
  endTime: string;
}): Promise<ActionResult<Song>> {
  // バリデーション
  if (!input.title.trim()) {
    return { success: false, error: '曲名を入力してください' };
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

  const { data, error } = await supabase
    .from('songs')
    .insert({
      video_id: input.videoDbId,
      title: input.title.trim(),
      artist: input.artist.trim() || null,
      start_sec: startSec,
      end_sec: endSec,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `曲の登録に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Song };
}
