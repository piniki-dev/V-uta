'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Playlist, PlaylistItem, ActionResult } from '@/types';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

/**
 * プレイリスト一覧を取得する（自分のもの、または公開プレイリスト）
 */
export async function getPlaylists(): Promise<ActionResult<Playlist[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('playlists')
    .select('*')
    .order('is_favorites', { ascending: false })
    .order('created_at', { ascending: false });

  if (user) {
    // ログイン中の場合: 自分の全て + 他人の公開分
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`);
  } else {
    // 未ログインの場合: 公開分のみ
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;

  if (error) {
    const t = await getLocaleT();
    return { success: false, error: `${t.common.searchError}: ${error.message}` };
  }

  return { success: true, data: data as Playlist[] };
}

/**
 * プレイリストを作成する
 */
export async function createPlaylist(name: string, description: string, isPublic: boolean): Promise<ActionResult<Playlist>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const t = await getLocaleT();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  if (!name.trim()) {
    return { success: false, error: t.playlist.enterName };
  }

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      is_public: isPublic,
      created_by: user.id
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `${t.common.saveError}: ${error.message}` };
  }

  revalidatePath('/playlists');
  return { success: true, data: data as Playlist };
}

/**
 * プレイリスト詳細（楽曲含む）を取得する
 */
export async function getPlaylistDetail(id: number): Promise<ActionResult<Playlist & { items: any[] }>> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      items:playlist_items (
        *,
        songs:songs (
          *,
          master_songs (*),
          video:videos (*, channels (*))
        )
      )
    `)
    .eq('id', id)
    .order('position', { foreignTable: 'playlist_items', ascending: true })
    .single();

  if (error) {
    const t = await getLocaleT();
    return { success: false, error: `${t.common.searchError}: ${error.message}` };
  }

  return { success: true, data: data as any };
}

/**
 * ログインユーザーのお気に入りプレイリスト詳細を取得する
 */
export async function getFavoritePlaylistDetail(): Promise<ActionResult<Playlist & { items: any[] }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const t = await getLocaleT();
    return { success: false, error: t.common.loginRequired };
  }
  
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      items:playlist_items (
        *,
        songs:songs (
          *,
          master_songs (*),
          video:videos (*, channels (*))
        )
      )
    `)
    .eq('created_by', user.id)
    .eq('is_favorites', true)
    .order('position', { foreignTable: 'playlist_items', ascending: true })
    .single();

  if (error) {
    const t = await getLocaleT();
    return { success: false, error: `${t.common.searchError}: ${error.message}` };
  }

  return { success: true, data: data as any };
}

/**
 * プレイリストに楽曲を追加する
 */
export async function addSongToPlaylist(playlistId: number, songId: number): Promise<ActionResult<PlaylistItem>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const t = await getLocaleT();
  if (!user) return { success: false, error: t.common.loginRequired };

  // 現在の最大位置を取得
  const { data: currentItems, error: fetchErr } = await supabase
    .from('playlist_items')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1);

  if (fetchErr) return { success: false, error: `${t.common.errorOccurred}: ${fetchErr.message}` };
  
  const nextPosition = currentItems.length > 0 ? currentItems[0].position + 1 : 0;

  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      song_id: songId,
      position: nextPosition
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `${t.common.saveError}: ${error.message}` };
  }

  revalidatePath(`/playlists/${playlistId}`);
  return { success: true, data: data as PlaylistItem };
}

/**
 * プレイリストから楽曲を削除する
 */
export async function removeSongFromPlaylist(playlistId: number, itemId: number): Promise<ActionResult<void>> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', itemId)
    .eq('playlist_id', playlistId);

  if (error) {
    const t = await getLocaleT();
    return { success: false, error: `${t.common.deleteError}: ${error.message}` };
  }

  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}

/**
 * プレイリスト情報を更新する
 */
export async function updatePlaylist(
  id: number, 
  data: { name?: string; description?: string; is_public?: boolean }
): Promise<ActionResult<Playlist>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const t = await getLocaleT();
  if (!user) return { success: false, error: t.common.loginRequired };

  const { data: updated, error } = await supabase
    .from('playlists')
    .update({
      name: data.name?.trim(),
      description: data.description?.trim(),
      is_public: data.is_public,
      updated_by: user.id
    })
    .eq('id', id)
    .eq('created_by', user.id) // 自分のプレイリストのみ
    .select()
    .single();

  if (error) {
    return { success: false, error: `${t.common.updateError}: ${error.message}` };
  }

  revalidatePath(`/playlists/${id}`);
  revalidatePath('/playlists');
  return { success: true, data: updated as Playlist };
}

/**
 * プレイリストの楽曲順序を一括更新する
 */
export async function updatePlaylistOrder(
  playlistId: number, 
  orderedItemIds: number[]
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const t = await getLocaleT();
  if (!user) return { success: false, error: t.common.loginRequired };

  // 1つずつ更新（小規模なプレイリストを想定）
  // 本来は upsert や一時テーブルを使った一括更新が望ましいが、実装のシンプルさを優先
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from('playlist_items')
      .update({ position: i })
      .eq('id', orderedItemIds[i])
      .eq('playlist_id', playlistId);

    if (error) {
      return { success: false, error: `${t.common.updateError}: ${error.message}` };
    }
  }

  revalidatePath(`/playlists/${playlistId}`);
  return { success: true };
}
