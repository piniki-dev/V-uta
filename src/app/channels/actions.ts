'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Channel } from '@/types';
import { unstable_cache } from 'next/cache';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// チャンネル一覧をキャッシュする関数
const getChannelsCached = unstable_cache(
  async () => {
    console.log('[unstable_cache] Fetching channels list from DB...');
    return getChannelsForStatic();
  },
  ['channels-list-cached'],
  {
    tags: ['channels-list']
  }
);

/**
 * すべての登録済みチャンネルを取得する
 */
export async function getChannels(): Promise<ActionResult<Channel[]>> {
  return getChannelsCached();
}

/**
 * メインチャンネルの一覧を取得する（ビルド・SSG用、クッキーなし）
 * 有効な曲（songs）が存在する動画・歌枠に紐づくチャンネルのみを取得する
 */
export async function getChannelsForStatic(): Promise<ActionResult<Channel[]>> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  // 1. 有効な曲が存在する song_channels 経由のチャンネルIDを抽出
  const { data: activeSongChannels } = await supabase
    .from('song_channels')
    .select('channel_id, song:songs!inner(id)')
    .not('song.is_active', 'eq', false);

  // 2. 有効な曲が存在する video_channels 経由のチャンネルIDを抽出
  const { data: activeVideoChannels } = await supabase
    .from('video_channels')
    .select('channel_id, video:videos!inner(songs!inner(id))')
    .not('video.songs.is_active', 'eq', false);

  const songChanIds = (activeSongChannels || []).map((sc) => sc.channel_id).filter(Boolean);
  const videoChanIds = (activeVideoChannels || []).map((vc) => vc.channel_id).filter(Boolean);

  const activeChannelIds = Array.from(new Set([...songChanIds, ...videoChanIds]));

  if (activeChannelIds.length === 0) {
    return { success: true, data: [] };
  }

  // 3. メインチャンネルを取得
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .in('id', activeChannelIds)
    .or('is_primary.eq.true,is_primary.is.null')
    .order('name', { ascending: true });

  if (error) {
    console.error('getChannelsForStatic error:', error);
    return { success: false, error: 'Failed to fetch channels for static rendering' };
  }

  return { success: true, data: (data || []) as Channel[] };
}

/**
 * すべての登録済みチャンネル（サブ含む）を取得する（generateStaticParams用）
 */
export async function getAllChannelsForStatic(): Promise<ActionResult<Channel[]>> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getAllChannelsForStatic error:', error);
    return { success: false, error: 'Failed to fetch all channels for static params' };
  }

  return { success: true, data: (data || []) as Channel[] };
}
