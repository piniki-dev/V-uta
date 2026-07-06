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
 * すべての登録済みチャンネルを取得する（ビルド・SSG用、クッキーなし）
 */
export async function getChannelsForStatic(): Promise<ActionResult<Channel[]>> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getChannelsForStatic error:', error);
    return { success: false, error: 'Failed to fetch channels for static rendering' };
  }

  return { success: true, data: data as Channel[] };
}
