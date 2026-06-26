'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Channel } from '@/types';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * すべて of 登録済みチャンネルを取得する
 */
export async function getChannels(): Promise<ActionResult<Channel[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getChannels error:', error);
    return { success: false, error: 'Failed to fetch channels' };
  }

  return { success: true, data: data as Channel[] };
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
