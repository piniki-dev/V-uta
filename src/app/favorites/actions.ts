'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

/**
 * お気に入りプレイリストを取得する
 */
async function getFavoritesPlaylist(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('playlists')
    .select('id')
    .eq('created_by', userId)
    .eq('is_favorites', true)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * 楽曲がお気に入りに入っているか確認する
 */
export async function isSongFavorited(songId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const favPlaylist = await getFavoritesPlaylist(user.id);
  if (!favPlaylist) return false;

  const { data } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', favPlaylist.id)
    .eq('song_id', songId)
    .limit(1)
    .single();

  return !!data;
}

/**
 * お気に入りをトグルする
 */
export async function toggleFavorite(songId: number): Promise<ActionResult<{ isFavorited: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getLocaleT();

  if (!user) return { success: false, error: t.common.loginRequired };

  // お気に入りプレイリストを取得
  let favPlaylist = await getFavoritesPlaylist(user.id);
  
  // もし何らかの理由でなければ作成を試みる（通常はトリガーで作成されているはず）
  if (!favPlaylist) {
    const { data: newPlaylist, error: createErr } = await supabase
      .from('playlists')
      .insert({
        name: 'お気に入りした曲',
        description: 'お気に入りした楽曲がここに表示されます',
        is_favorites: true,
        created_by: user.id,
        is_public: false
      })
      .select('id')
      .single();

    if (createErr) return { success: false, error: `${t.common.errorOccurred}: ${createErr.message}` };
    favPlaylist = newPlaylist;
  }

  // 既に入っているか確認
  const { data: existingItem } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', favPlaylist.id)
    .eq('song_id', songId)
    .single();

  if (existingItem) {
    // 削除
    const { error: delErr } = await supabase
      .from('playlist_items')
      .delete()
      .eq('id', existingItem.id);

    if (delErr) return { success: false, error: `${t.common.deleteError}: ${delErr.message}` };
    
    revalidatePath(`/playlists/${favPlaylist.id}`);
    revalidatePath('/playlists/favorite');
    revalidatePath('/history'); // 履歴ページなどにも影響するため
    return { success: true, data: { isFavorited: false } };
  } else {
    // 追加
    // 現在の最大位置を取得
    const { data: currentItems } = await supabase
      .from('playlist_items')
      .select('position')
      .eq('playlist_id', favPlaylist.id)
      .order('position', { ascending: false })
      .limit(1);
    
    const nextPosition = currentItems && currentItems.length > 0 ? currentItems[0].position + 1 : 0;

    const { error: insErr } = await supabase
      .from('playlist_items')
      .insert({
        playlist_id: favPlaylist.id,
        song_id: songId,
        position: nextPosition
      });

    if (insErr) return { success: false, error: `${t.common.saveError}: ${insErr.message}` };
    
    revalidatePath(`/playlists/${favPlaylist.id}`);
    revalidatePath('/playlists/favorite');
    revalidatePath('/history');
    return { success: true, data: { isFavorited: true } };
  }
}

/**
 * ログインユーザーのお気に入り楽曲IDリストを取得する
 */
export async function getFavoriteSongIds(): Promise<number[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const favPlaylist = await getFavoritesPlaylist(user.id);
  if (!favPlaylist) return [];

  const { data, error } = await supabase
    .from('playlist_items')
    .select('song_id')
    .eq('playlist_id', favPlaylist.id);

  if (error || !data) return [];
  return data.map(item => item.song_id);
}
