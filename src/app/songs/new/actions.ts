'use server';

import { createClient } from '@/utils/supabase/server';
import { extractVideoId, fetchVideoMetadata, fetchChannelMetadata } from '@/lib/youtube';
import { searchTracks as itunesSearch, getHighResArtwork, getTrackById } from '@/lib/itunes';
import type { Video, Song, YouTubeVideoMetadata, Channel, Production } from '@/types';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';

async function getLocaleT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  return translations[locale];
}

// ===== 時刻ユーティリティ =====

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

// ===== レスポンス型 =====

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ===== iTunes 検索結果の型（クライアントに返す用） =====

export interface ITunesSearchResult {
  trackId: number;
  title: string;
  artist: string;
  albumName: string;
  artworkUrl: string; // 高解像度に変換済み
  durationSec: number; // 曲の長さ（秒）
}

// ===== Server Actions =====

/**
 * iTunes Search API で曲を検索する
 */
export async function searchSongAction(
  query: string,
  country = 'jp',
  lang = 'ja_jp'
): Promise<ActionResult<ITunesSearchResult[]>> {
  const t = await getLocaleT();
  if (!query.trim()) {
    return { success: false, error: t.search.inputKeyword };
  }

  try {
    const tracks = await itunesSearch(query, 10, country, lang);
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
 * YouTube URL からメタデータを取得してプレビュー表示用に返す
 * すでに登録済みの場合は、既存の曲リストもあわせて返す
 */
export async function fetchVideoPreview(
  url: string
): Promise<ActionResult<{ 
  metadata: YouTubeVideoMetadata; 
  existingSongs: Song[];
  isChannelRegistered: boolean;
  channelData?: any;
}>> {
  const videoId = extractVideoId(url);
  const t = await getLocaleT();
  if (!videoId) {
    return { success: false, error: t.newSong.inputYoutubeUrl };
  }

  try {
    const metadata = await fetchVideoMetadata(videoId);
    if (!metadata) {
      return { success: false, error: t.archive.notFound };
    }

    const supabase = await createClient();
    
    // チャンネルが登録済みかチェック
    const { data: channelRecord } = await supabase
      .from('channels')
      .select('id, vtuber_id')
      .eq('yt_channel_id', metadata.channelId)
      .single();

    let isChannelRegistered = !!channelRecord;
    let channelData = null;

    if (!isChannelRegistered) {
      // 未登録ならチャンネル情報を追加取得
      channelData = await fetchChannelMetadata(metadata.channelId);
    }

    // DB に動画が登録済みかチェック
    const { data: videoData } = await supabase
      .from('videos')
      .select('id')
      .eq('video_id', videoId)
      .single();

    let existingSongs: Song[] = [];
    if (videoData) {
      // 登録済みの曲を取得
      const { data: songsData } = await supabase
        .from('songs')
        .select('*, master_songs(*)')
        .eq('video_id', videoData.id)
        .order('start_sec', { ascending: true });
      
      if (songsData) {
        existingSongs = songsData as Song[];
      }
    }

    return { 
      success: true, 
      data: { 
        metadata, 
        existingSongs,
        isChannelRegistered,
        channelData
      } 
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.errorOccurred;
    return { success: false, error: message };
  }
}

/**
 * 事務所一覧を取得する
 */
export async function getProductions(): Promise<ActionResult<Production[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('productions')
    .select('*')
    .order('name');
  
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

/**
 * VTuber とチャンネルを一括で登録する
 */
export async function registerVtuberAndChannel(params: {
  vtuberName: string;
  gender: string;
  vtuberLink?: string;
  productionId?: number;
  newProductionName?: string;
  channelData: {
    ytChannelId: string;
    name: string;
    handle: string;
    description: string;
    image: string;
  };
}): Promise<ActionResult<{ vtuberId: number; channelId: number }>> {
  const supabase = await createClient();
  const t = await getLocaleT();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  try {
    let productionId = params.productionId;

    // 新規事務所の登録
    if (!productionId && params.newProductionName) {
      console.log('Registering new production:', params.newProductionName);
      const { data: newProd, error: prodErr } = await supabase
        .from('productions')
        .insert({ name: params.newProductionName, created_by: user.id })
        .select('id')
        .single();
      
      if (prodErr) {
        console.error('Production insert error:', prodErr);
        throw prodErr;
      }
      productionId = newProd.id;
      console.log('Production registered with ID:', productionId);
    }

    // VTuber の登録
    console.log('Registering vtuber:', params.vtuberName);
    const { data: vtuber, error: vtErr } = await supabase
      .from('vtubers')
      .insert({
        name: params.vtuberName,
        gender: params.gender,
        link: params.vtuberLink,
        production_id: productionId || null,
        created_by: user.id,
      })
      .select('id')
      .single();
    
    if (vtErr) {
      console.error('VTuber insert error:', vtErr);
      throw vtErr;
    }
    console.log('VTuber registered with ID:', vtuber.id);

    // チャンネルの登録
    console.log('Registering channel:', params.channelData.name);
    const { data: channel, error: chanErr } = await supabase
      .from('channels')
      .insert({
        yt_channel_id: params.channelData.ytChannelId,
        name: params.channelData.name,
        handle: params.channelData.handle,
        description: params.channelData.description,
        image: params.channelData.image,
        vtuber_id: vtuber.id,
        created_by: user.id,
      })
      .select('id')
      .single();
    
    if (chanErr) {
      console.error('Channel insert error:', chanErr);
      throw chanErr;
    }
    console.log('Channel registered with ID:', channel.id);

    return { success: true, data: { vtuberId: vtuber.id, channelId: channel.id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.saveError;
    return { success: false, error: message };
  }
}

/**
 * 動画を videos テーブルに登録（既に存在する場合はそのまま返す）
 */
export async function registerVideo(
  metadata: YouTubeVideoMetadata
): Promise<ActionResult<Video>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  // 既存チェック
  const { data: existing } = await supabase
    .from('videos')
    .select('*')
    .eq('video_id', metadata.videoId)
    .single();

  if (existing) {
    return { success: true, data: existing as Video };
  }

  // チャンネルの内部 ID を取得
  const { data: channelRecord } = await supabase
    .from('channels')
    .select('id')
    .eq('yt_channel_id', metadata.channelId)
    .single();

  if (!channelRecord) {
    return { success: false, error: `${t.vtuber.linkedChannel} (ID: ${metadata.channelId}) ${t.archive.noArchives}` }; // 暫定
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      video_id: metadata.videoId,
      title: metadata.title,
      description: metadata.description,
      thumbnail_url: metadata.thumbnailUrl,
      published_at: metadata.publishedAt,
      duration: metadata.duration,
      channel_record_id: channelRecord.id,
      is_stream: metadata.isStream,
      is_publish: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `${t.common.saveError}: ${error.message}` };
  }

  return { success: true, data: data as Video };
}

/**
 * 歌（曲の区間）を songs テーブルに登録
 * master_songs テーブルに原曲情報を UPSERT し、その ID を songs に紐付ける
 */
export async function registerSong(input: {
  videoDbId: number;
  songTitle: string;
  songArtist: string;
  artworkUrl: string;
  itunesId: string;
  durationSec: number;
  startTime: string;
  endTime: string;
  searchLocale?: 'ja' | 'en';
}): Promise<ActionResult<Song>> {
  const t = await getLocaleT();
  // バリデーション
  if (!input.songTitle.trim()) {
    return { success: false, error: t.newSong.searchByName }; // 暫定
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

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  // master_songs の存在チェック（itunes_id または 曲名+アーティスト名で名寄せ）
  let masterSong = null;
  if (input.itunesId) {
    const { data: byItunes } = await supabase
      .from('master_songs')
      .select()
      .eq('itunes_id', String(input.itunesId))
      .maybeSingle();
    masterSong = byItunes;
  }

  if (!masterSong) {
    const { data: byTitle } = await supabase
      .from('master_songs')
      .select()
      .eq('title', input.songTitle.trim())
      .eq('artist', input.songArtist.trim() || 'Unknown')
      .maybeSingle();
    masterSong = byTitle;
  }

  // 存在しない場合は新規登録
  if (!masterSong) {
    let titleJa = input.songTitle.trim();
    let artistJa = input.songArtist.trim() || 'Unknown';
    let titleEn = null;
    let artistEn = null;

    // iTunes ID があるなら、反対の言語情報も取得
    if (input.itunesId) {
      const otherLocale = input.searchLocale === 'en' ? 'ja' : 'en';
      const country = otherLocale === 'en' ? 'us' : 'jp';
      const lang = otherLocale === 'en' ? 'en_us' : 'ja_jp';
      
      const otherInfo = await getTrackById(input.itunesId, country, lang);
      if (otherInfo) {
        if (input.searchLocale === 'en') {
          // 検索時が英語モード：inputは英語、otherInfoが日本語
          titleEn = input.songTitle.trim();
          artistEn = input.songArtist.trim();
          titleJa = otherInfo.trackName;
          artistJa = otherInfo.artistName;
        } else {
          // 検索時が日本語モード：inputは日本語、otherInfoが英語
          titleJa = input.songTitle.trim();
          artistJa = input.songArtist.trim();
          titleEn = otherInfo.trackName;
          artistEn = otherInfo.artistName;
        }
      } else {
        // 反対側の情報が取れなかった場合
        if (input.searchLocale === 'en') {
          titleEn = input.songTitle.trim();
          artistEn = input.songArtist.trim();
        }
      }
    }

    const { data: newMaster, error: masterInsertError } = await supabase
      .from('master_songs')
      .insert({
        title: titleJa,
        artist: artistJa,
        title_en: titleEn,
        artist_en: artistEn,
        artwork_url: input.artworkUrl || null,
        itunes_id: input.itunesId ? String(input.itunesId) : null,
        duration_sec: input.durationSec > 0 ? input.durationSec : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (masterInsertError) {
      return { success: false, error: `${t.common.saveError} (master): ${masterInsertError.message}` };
    }
    masterSong = newMaster;
  }

  // songs テーブルに INSERT
  const { data, error } = await supabase
    .from('songs')
    .insert({
      video_id: input.videoDbId,
      master_song_id: masterSong.id,
      start_sec: startSec,
      end_sec: endSec,
      created_by: user.id,
    })
    .select('*, master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.saveError}: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 動画情報と曲リストをまとめて一括登録・更新する
 */
export async function registerFullArchive(input: {
  videoMetadata: YouTubeVideoMetadata;
  songs: {
    id?: number;
    songTitle: string;
    songArtist: string;
    artworkUrl: string;
    itunesId: string;
    durationSec: number;
    startSec: number;
    endSec: number;
    isDeleted?: boolean;
    searchLocale?: 'ja' | 'en';
  }[];
}): Promise<ActionResult<{ video: Video; songs: Song[] }>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  try {
    // 1. 動画の登録/取得
    const videoResult = await registerVideo(input.videoMetadata);
    if (!videoResult.success) return { success: false, error: videoResult.error };
    const video = videoResult.data;

    const finalSongs: Song[] = [];

    // 2. 曲の処理
    for (const songInput of input.songs) {
      if (songInput.isDeleted) {
        if (songInput.id) {
          const { error } = await supabase.from('songs').delete().eq('id', songInput.id);
          if (error) throw new Error(`曲の削除に失敗しました: ${error.message}`);
        }
        continue;
      }

      // master_songs の存在チェック（itunes_id または 曲名+アーティスト名）
      let masterSong = null;
      if (songInput.itunesId) {
        const { data: byItunes } = await supabase
          .from('master_songs')
          .select()
          .eq('itunes_id', String(songInput.itunesId))
          .maybeSingle();
        masterSong = byItunes;
      }

      if (!masterSong) {
        const { data: byTitle } = await supabase
          .from('master_songs')
          .select()
          .eq('title', songInput.songTitle.trim())
          .eq('artist', songInput.songArtist.trim() || 'Unknown')
          .maybeSingle();
        masterSong = byTitle;
      }

      if (!masterSong) {
        let titleJa = songInput.songTitle.trim();
        let artistJa = songInput.songArtist.trim() || 'Unknown';
        let titleEn = null;
        let artistEn = null;

        if (songInput.itunesId) {
          const otherLocale = songInput.searchLocale === 'en' ? 'ja' : 'en';
          const country = otherLocale === 'en' ? 'us' : 'jp';
          const lang = otherLocale === 'en' ? 'en_us' : 'ja_jp';
          const otherInfo = await getTrackById(songInput.itunesId, country, lang);
          if (otherInfo) {
            if (songInput.searchLocale === 'en') {
              titleEn = songInput.songTitle.trim();
              artistEn = songInput.songArtist.trim();
              titleJa = otherInfo.trackName;
              artistJa = otherInfo.artistName;
            } else {
              titleJa = songInput.songTitle.trim();
              artistJa = songInput.songArtist.trim();
              titleEn = otherInfo.trackName;
              artistEn = otherInfo.artistName;
            }
          } else {
            if (songInput.searchLocale === 'en') {
              titleEn = songInput.songTitle.trim();
              artistEn = songInput.songArtist.trim();
            }
          }
        }

        const { data: newMaster, error: masterInsertError } = await supabase
          .from('master_songs')
          .insert({
            title: titleJa,
            artist: artistJa,
            title_en: titleEn,
            artist_en: artistEn,
            artwork_url: songInput.artworkUrl || null,
            itunes_id: songInput.itunesId ? String(songInput.itunesId) : null,
            duration_sec: songInput.durationSec > 0 ? songInput.durationSec : null,
            created_by: user.id,
          })
          .select()
          .single();
        
        if (masterInsertError) throw new Error(`原曲情報の登録に失敗しました: ${masterInsertError.message}`);
        masterSong = newMaster;
      }

      if (songInput.id) {
        // 更新
        const { data, error } = await supabase
          .from('songs')
          .update({
            master_song_id: masterSong.id,
            start_sec: songInput.startSec,
            end_sec: songInput.endSec,
            updated_by: user.id,
          })
          .eq('id', songInput.id)
          .select('*, master_songs(*)')
          .single();
        if (error) throw new Error(`曲の更新に失敗しました: ${error.message}`);
        finalSongs.push(data as Song);
      } else {
        // 新規登録
        const { data, error } = await supabase
          .from('songs')
          .insert({
            video_id: video.id,
            master_song_id: masterSong.id,
            start_sec: songInput.startSec,
            end_sec: songInput.endSec,
            created_by: user.id,
          })
          .select('*, master_songs(*)')
          .single();
        if (error) throw new Error(`曲の登録に失敗しました: ${error.message}`);
        finalSongs.push(data as Song);
      }
    }

    return { success: true, data: { video, songs: finalSongs } };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.saveError;
    return { success: false, error: message };
  }
}

/**
 * チャンネル詳細と紐付く動画・曲リストを取得する (ID またはハンドルに対応)
 */
export async function getChannelWithVideos(identifier: string | number): Promise<ActionResult<Channel & { videos: (Video & { songs: Song[] })[] }>> {
  console.log('getChannelWithVideos called with identifier:', identifier);
  const supabase = await createClient();
  const t = await getLocaleT();

  let query = supabase
    .from('channels')
    .select(`
      *,
      vtuber:vtubers (
        *,
        production:productions (*)
      )
    `);

  if (typeof identifier === 'string' && identifier.startsWith('@')) {
    // ハンドルで検索 (大文字小文字を区別しない)
    query = query.ilike('handle', identifier);
  } else {
    // ID で検索
    query = query.eq('id', Number(identifier));
  }

  const { data: channel, error: chanErr } = await query.single();

  if (chanErr || !channel) {
    // ハンドルで不一致の場合、@ を取って再試行
    if (typeof identifier === 'string' && identifier.startsWith('@')) {
      const { data: retryChannel } = await supabase
        .from('channels')
        .select(`
          *,
          vtuber:vtubers (
            *,
            production:productions (*)
          )
        `)
        .eq('handle', identifier.substring(1))
        .single();
      
      if (retryChannel) {
        return fetchVideosForChannel(retryChannel, supabase);
      }
    }
    return { success: false, error: t.archive.notFound };
  }

  return fetchVideosForChannel(channel, supabase);
}

/**
 * 内部補助関数: チャンネルに紐付く動画と曲をまとめて取得・マッピングする
 */
async function fetchVideosForChannel(channel: any, supabase: any): Promise<ActionResult<any>> {
  const t = await getLocaleT();
  const { data: videos, error: vidErr } = await supabase
    .from('videos')
    .select(`
      *,
      songs (
        *,
        master_songs (*)
      )
    `)
    .eq('channel_record_id', channel.id)
    .order('published_at', { ascending: false });

  if (vidErr) {
    console.error('fetchVideosForChannel error:', vidErr);
    return { success: false, error: `${t.common.errorOccurred} (videos)` };
  }

  return {
    success: true,
    data: {
      ...channel,
      videos: (videos || []) as (Video & { songs: Song[] })[]
    }
  };
}
