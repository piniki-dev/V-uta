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
    title: string;
    artist: string;
    start_sec: number;
    end_sec: number;
    master_songs: {
      artwork_url: string | null;
    } | null;
    videos: {
      video_id: string;
      title: string;
      channels: {
        name: string;
      } | null;
    };
  };
};

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
  metaData?: any;
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
            name
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('played_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching play history:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as any[] };
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
