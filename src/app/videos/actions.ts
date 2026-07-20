'use server';

import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Video } from '@/types';

/**
 * 最近追加された動画リストをキャッシュ (過去7日間分を1時間ごと自動更新 + 手動パージ)
 */
export const getHomeVideosCached = unstable_cache(
  async () => {
    console.log('[unstable_cache] Fetching home videos from DB...');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    // 7日前の日時を計算 (ISO-8601 形式)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { data: videoData, error } = await supabase
      .from('videos')
      .select('*, channel:channels(*), songs!inner(id)')
      .gte('created_at', sevenDaysAgoISO)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('getHomeVideosCached error:', error);
      return [];
    }

    const videos = ((videoData as unknown as Video[]) || [])
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    return videos;
  },
  ['home-videos-cached'],
  {
    revalidate: 3600, // 過去7日間の基準時刻が経過するのに合わせて自動更新
    tags: ['home-videos']
  }
);
