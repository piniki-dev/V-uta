'use server';

import { createClient } from '@/utils/supabase/server';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

export type HistoryItem = {
  id: number;
  played_at: string;
  play_duration: number | null;
  source_type: string | null;
  source_id: string | null;
  songs: {
    id: number;
    start_sec: number;
    end_sec: number;
    master_songs: {
      title: string;
      artist: string;
      title_en?: string | null;
      artist_en?: string | null;
      artwork_url: string | null;
    } | null;
    videos: {
      video_id: string;
      title: string;
      thumbnail_url: string | null;
      channels: {
        name: string;
        image: string | null;
      } | null;
    };
  };
};

export interface RankingResult {
  song_id: number;
  play_count: number;
  master_song_title: string;
  master_song_artist: string;
  master_song_title_en: string | null;
  master_song_artist_en: string | null;
  artwork_url: string | null;
  video_id: string;
  video_title: string | null;
  channel_name: string | null;
  channel_image: string | null;
  start_sec: number;
  end_sec: number;
}

export interface FormattedRankingSong {
  id: number;
  playCount: number;
  title: string;
  artist: string;
  title_en: string | null;
  artist_en: string | null;
  artworkUrl: string | null;
  videoId: string;
  videoTitle: string | null;
  channelName: string | null;
  channelThumbnailUrl: string | null;
  startSec: number;
  endSec: number;
  thumbnailUrl: string;
}

/**
 * 再生履歴を記録する
 */
export async function recordPlayHistory(params: {
  songId: number;
  playDuration?: number;
  sourceType?: string;
  sourceId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const t = await getLocaleT();
    return { success: false, error: t.common.loginRequired };
  }

  const { data, error } = await supabase
    .from('play_history')
    .insert({
      user_id: user.id,
      song_id: params.songId,
      play_duration: params.playDuration,
      source_type: params.sourceType,
      source_id: params.sourceId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error recording play history:', error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id as number };
}

/**
 * 再生時間を更新する
 */
export async function updatePlayDuration(params: {
  historyId: number;
  playDuration: number;
  lastPosition?: number;
  completionRate?: number;
  isCompleted?: boolean;
  metaData?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('play_history')
    .update({ 
      play_duration: params.playDuration,
      last_position: params.lastPosition,
      completion_rate: params.completionRate,
      is_completed: params.isCompleted,
      meta_data: params.metaData,
    })
    .eq('id', params.historyId);

  if (error) {
    console.error('Error updating play duration:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 再生履歴を取得する
 */
export async function getPlayHistory(limit = 50, offset = 0) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const t = await getLocaleT();
    return { success: false, error: t.common.loginRequired };
  }

  const { data, error } = await supabase
    .from('play_history')
    .select(`
      id,
      played_at,
      play_duration,
      source_type,
      source_id,
      songs (
        id,
        start_sec,
        end_sec,
        master_songs (
          title,
          artist,
          artwork_url
        ),
        videos (
          video_id,
          title,
          thumbnail_url,
          channels (
            name,
            image
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('played_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { success: true, data: data as unknown as HistoryItem[] };
}

/**
 * 再生履歴を全削除する
 */
export async function clearPlayHistory() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const t = await getLocaleT();
    return { success: false, error: t.common.loginRequired };
  }

  const { error } = await supabase
    .from('play_history')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('Error clearing play history:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 再生回数ランキングを取得する
 */
export async function getSongRankings(params: {
  channelId?: bigint;
  userId?: string;
  days?: number;
  groupByMaster?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; data?: FormattedRankingSong[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_song_rankings', {
    p_channel_id: params.channelId,
    p_user_id: params.userId,
    p_days: params.days,
    p_group_by_master: params.groupByMaster || false,
    p_limit: params.limit || 10,
    p_offset: params.offset || 0,
  });

  if (error) {
    console.error('Error fetching song rankings:', error);
    return { success: false, error: error.message };
  }

  // RPC の戻り値を PlayerSong 互換の形式に整形
  const rankings = ((data as RankingResult[]) || []).map((item) => ({
    id: item.song_id,
    playCount: item.play_count,
    title: item.master_song_title,
    artist: item.master_song_artist,
    title_en: item.master_song_title_en,
    artist_en: item.master_song_artist_en,
    artworkUrl: item.artwork_url,
    videoId: item.video_id,
    videoTitle: item.video_title,
    channelName: item.channel_name,
    channelThumbnailUrl: item.channel_image,
    startSec: item.start_sec,
    endSec: item.end_sec,
    thumbnailUrl: `https://i.ytimg.com/vi/${item.video_id}/mqdefault.jpg`, // デフォルトのサムネイル
  }));

  return { success: true, data: rankings };
}
