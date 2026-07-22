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
 * 投稿動画またはコラボ動画に有効な曲が存在するチャンネルのみを取得する
 */
export async function getChannelsForStatic(): Promise<ActionResult<Channel[]>> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  // 1. 有効な曲(songs)が存在する動画 ID を取得
  const { data: songsData } = await supabase
    .from('songs')
    .select('video_id')
    .not('is_active', 'eq', false);

  if (!songsData || songsData.length === 0) {
    return { success: true, data: [] };
  }

  const validVideoDbIds = Array.from(new Set(songsData.map((s) => s.video_id)));

  // 2. 有効な動画の channel_record_id (投稿元) と video_channels (コラボ) を合算
  const { data: videosData } = await supabase
    .from('videos')
    .select('id, channel_record_id')
    .in('id', validVideoDbIds);

  const ownChannelIds = (videosData || []).map((v) => v.channel_record_id).filter(Boolean);

  const { data: videoChanData } = await supabase
    .from('video_channels')
    .select('channel_id')
    .in('video_id', validVideoDbIds);

  const collabChannelIds = (videoChanData || []).map((vc) => vc.channel_id).filter(Boolean);

  const activeChannelIds = Array.from(new Set([...ownChannelIds, ...collabChannelIds]));

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

  // 1. 有効な曲(songs)が存在する動画 ID を取得
  const { data: songsData } = await supabase
    .from('songs')
    .select('video_id')
    .not('is_active', 'eq', false);

  if (!songsData || songsData.length === 0) {
    return { success: true, data: [] };
  }

  const validVideoDbIds = Array.from(new Set(songsData.map((s) => s.video_id)));

  // 2. 有効な動画の channel_record_id (投稿元) と video_channels (コラボ) を合算
  const { data: videosData } = await supabase
    .from('videos')
    .select('id, channel_record_id')
    .in('id', validVideoDbIds);

  const ownChannelIds = (videosData || []).map((v) => v.channel_record_id).filter(Boolean);

  const { data: videoChanData } = await supabase
    .from('video_channels')
    .select('channel_id')
    .in('video_id', validVideoDbIds);

  const collabChannelIds = (videoChanData || []).map((vc) => vc.channel_id).filter(Boolean);

  const activeChannelIds = Array.from(new Set([...ownChannelIds, ...collabChannelIds]));

  if (activeChannelIds.length === 0) {
    return { success: true, data: [] };
  }

  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .in('id', activeChannelIds)
    .order('name', { ascending: true });

  if (error) {
    console.error('getAllChannelsForStatic error:', error);
    return { success: false, error: 'Failed to fetch all channels for static params' };
  }

  return { success: true, data: (data || []) as Channel[] };
}
