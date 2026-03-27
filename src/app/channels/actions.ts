'use server';

import { createClient } from '@/utils/supabase/server';
import type { Channel } from '@/types';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * すべての登録済みチャンネルを取得する
 */
export async function getChannels(): Promise<ActionResult<Channel[]>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getChannels error:', error);
    return { success: false, error: t.common.errorOccurred };
  }

  return { success: true, data: data as Channel[] };
}
