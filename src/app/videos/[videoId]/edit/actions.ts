'use server';

import { createClient } from '@/utils/supabase/server';
import { searchTracks, getHighResArtwork, getTrackById } from '@/lib/itunes';
import type { Song } from '@/types';
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

// ===== iTunes 検索結果（再利用） =====
export interface ITunesSearchResult {
  trackId: number;
  title: string;
  artist: string;
  albumName: string;
  artworkUrl: string;
  durationSec: number;
}

/**
 * iTunes で曲を検索する（編集ページ用）
 */
export async function searchSongForEdit(
  query: string,
  country = 'jp',
  lang = 'ja_jp'
): Promise<ActionResult<ITunesSearchResult[]>> {
  const t = await getLocaleT();
  if (!query.trim()) {
    return { success: false, error: t.search.inputKeyword };
  }

  try {
    const tracks = await searchTracks(query, 10, country, lang);
    const results: ITunesSearchResult[] = tracks.map((t) => ({
      trackId: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      albumName: t.collectionName,
      artworkUrl: getHighResArtwork(t.artworkUrl100, 300),
      durationSec: Math.round((t.trackTimeMillis || 0) / 1000),
    }));
    return { success: true, data: results };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.searchError;
    return { success: false, error: message };
  }
}

/**
 * "mm:ss" 形式を秒に変換
 */
function parseTimeToSeconds(time: string): number | null {
  const match = time.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/**
 * 曲の区間情報を更新する
 */
export async function updateSong(input: {
  songId: number;
  startTime: string;
  endTime: string;
}): Promise<ActionResult<Song>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  const startSec = parseTimeToSeconds(input.startTime);
  const endSec = parseTimeToSeconds(input.endTime);

  if (startSec === null || endSec === null) {
    return { success: false, error: t.newSong.timeFormatError };
  }
  if (startSec >= endSec) {
    return { success: false, error: t.newSong.timeError };
  }
  if (endSec - startSec < 10) {
    return { success: false, error: t.newSong.durationError };
  }

  const { data, error } = await supabase
    .from('songs')
    .update({
      start_sec: startSec,
      end_sec: endSec,
    })
    .eq('id', input.songId)
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.updateError}: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 曲の原曲情報を変更する（master_songs を UPSERT して songs.master_song_id を更新）
 */
export async function updateSongMaster(input: {
  songId: number;
  songTitle: string;
  songArtist: string;
  artworkUrl: string;
  itunesId: string;
  durationSec: number;
  searchLocale?: 'ja' | 'en';
}): Promise<ActionResult<Song>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  let titleJa = input.songTitle.trim();
  let artistJa = input.songArtist.trim() || 'Unknown';
  let titleEn = null;
  let artistEn = null;

  // iTunes ID がある場合、反対の地域のメタデータを自動取得
  if (input.itunesId) {
    const otherLocale = input.searchLocale === 'en' ? 'ja' : 'en';
    const country = otherLocale === 'en' ? 'us' : 'jp';
    const lang = otherLocale === 'en' ? 'en_us' : 'ja_jp';
    
    const otherInfo = await getTrackById(input.itunesId, country, lang);
    if (otherInfo) {
      if (input.searchLocale === 'en') {
        titleEn = input.songTitle.trim();
        artistEn = input.songArtist.trim();
        titleJa = otherInfo.trackName;
        artistJa = otherInfo.artistName;
      } else {
        titleJa = input.songTitle.trim();
        artistJa = input.songArtist.trim();
        titleEn = otherInfo.trackName;
        artistEn = otherInfo.artistName;
      }
    } else {
      if (input.searchLocale === 'en') {
        titleEn = input.songTitle.trim();
        artistEn = input.songArtist.trim();
      }
    }
  }

  // master_songs に UPSERT
  const { data: masterSong, error: masterError } = await supabase
    .from('master_songs')
    .upsert(
      {
        title: titleJa,
        artist: artistJa,
        title_en: titleEn,
        artist_en: artistEn,
        artwork_url: input.artworkUrl || null,
        itunes_id: input.itunesId ? String(input.itunesId) : null,
        duration_sec: input.durationSec > 0 ? input.durationSec : null,
      },
      { onConflict: 'title,artist' }
    )
    .select()
    .single();

  if (masterError) {
    return { success: false, error: `${t.common.updateError} (master): ${masterError.message}` };
  }

  // songs の master_song_id を更新
  const { data, error } = await supabase
    .from('songs')
    .update({ master_song_id: masterSong.id })
    .eq('id', input.songId)
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.updateError}: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 曲を削除する（論理削除: is_active = false）
 */
export async function deleteSong(
  songId: number
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  const { error } = await supabase
    .from('songs')
    .update({ is_active: false })
    .eq('id', songId);

  if (error) {
    return { success: false, error: `${t.common.deleteError}: ${error.message}` };
  }

  return { success: true, data: null };
}
