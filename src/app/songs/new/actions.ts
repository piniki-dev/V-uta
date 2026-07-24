'use server';

import { createClient } from '@/utils/supabase/server';
import { extractVideoId, fetchVideoMetadata, fetchChannelMetadata, fetchMultipleChannelsMetadata, fetchChannelByHandle } from '@/lib/youtube';
import { fetchCollaboratorChannels } from '@/lib/youtube-collab';
import { searchTracks as itunesSearch, getHighResArtwork, getTrackById } from '@/lib/itunes';
import type { Video, Song, YouTubeVideoMetadata, Channel, Production, Vtuber } from '@/types';
import { translations } from '@/lib/translations';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { convertGSheetUrlToCsv } from '@/utils/batch-parser';
import { getChannelUrl } from '@/lib/utils';

export interface CollaboratorChannelPreview {
  ytChannelId: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
  description?: string;
  isRegistered: boolean;
  channelRecordId?: number;
  isOriginalUploader: boolean;
}

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

/**
 * 指定した YouTube チャンネルIDのメタデータ（アイコン画像など）を取得する
 */
export async function fetchChannelMetadataAction(
  ytChannelId: string
): Promise<ActionResult<{ name: string; handle?: string; image?: string; description?: string }>> {
  try {
    const meta = await fetchChannelMetadata(ytChannelId);
    if (!meta) {
      return { success: false, error: 'Channel metadata not found' };
    }
    return {
      success: true,
      data: {
        name: meta.name,
        handle: meta.handle,
        image: meta.image,
        description: meta.description,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch channel metadata';
    return { success: false, error: message };
  }
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
  existingSongs: (Song & { channelIds?: number[] })[];
  isChannelRegistered: boolean;
  channelData?: Record<string, unknown> | null;
  collaboratorChannels: CollaboratorChannelPreview[];
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

    const isChannelRegistered = !!channelRecord;
    let channelData = null;

    if (!isChannelRegistered) {
      // 未登録ならチャンネル情報を追加取得
      channelData = await fetchChannelMetadata(metadata.channelId);
    }

    // InnerTube API を叩いてコラボレーター情報を並行取得
    const rawCollaborators = await fetchCollaboratorChannels(videoId);

    // YouTube チャンネル ID リストを作成（メタデータのチャンネル + コラボチャンネル）
    const allYtIds = Array.from(new Set([metadata.channelId, ...rawCollaborators.map(c => c.ytChannelId)]));

    // DB 内の全対象チャンネルを一括検索
    const { data: registeredChannels } = await supabase
      .from('channels')
      .select('id, yt_channel_id, name, handle, image')
      .in('yt_channel_id', allYtIds);

    const regMap = new Map<string, { id: number; name: string; handle: string | null; image: string | null }>();
    (registeredChannels || []).forEach(c => regMap.set(c.yt_channel_id, c));

    // DB未登録のコラボチャンネルについて、YouTube Data API v3 で常に最新フル情報（概要欄 description, image, handle）を一括取得
    const unregisteredYtIds = rawCollaborators
      .map(c => c.ytChannelId)
      .filter(id => id !== metadata.channelId && !regMap.has(id));

    const ytMetaMap = await fetchMultipleChannelsMetadata(unregisteredYtIds);

    // コラボレーターリストを構築
    const collaboratorChannels: CollaboratorChannelPreview[] = [];

    // メインアップローダー
    const mainReg = regMap.get(metadata.channelId);
    collaboratorChannels.push({
      ytChannelId: metadata.channelId,
      name: mainReg?.name || metadata.channelName,
      handle: mainReg?.handle || undefined,
      avatarUrl: mainReg?.image || metadata.thumbnailUrl,
      description: channelData?.description || '',
      isRegistered: !!mainReg,
      channelRecordId: mainReg?.id,
      isOriginalUploader: true,
    });

    // コラボ先のチャンネル
    for (const collab of rawCollaborators) {
      if (collab.ytChannelId === metadata.channelId) continue;
      const reg = regMap.get(collab.ytChannelId);
      const ytMeta = ytMetaMap.get(collab.ytChannelId);

      collaboratorChannels.push({
        ytChannelId: collab.ytChannelId,
        name: reg?.name || ytMeta?.name || collab.name,
        handle: reg?.handle || ytMeta?.handle || collab.handle,
        avatarUrl: reg?.image || ytMeta?.image || collab.avatarUrl,
        description: ytMeta?.description || '',
        isRegistered: !!reg,
        channelRecordId: reg?.id,
        isOriginalUploader: false,
      });
    }

    // DB に動画が登録済みかチェック
    const { data: videoData } = await supabase
      .from('videos')
      .select('id')
      .eq('video_id', videoId)
      .single();

    let existingSongs: (Song & { channelIds?: number[] })[] = [];
    if (videoData) {
      // 登録済みの video_channels を DB から取得して collaboratorChannels に反映
      const { data: dbVcData } = await supabase
        .from('video_channels')
        .select('channel_id, is_original, channel:channels(id, yt_channel_id, name, handle, image)')
        .eq('video_id', videoData.id);

      if (dbVcData) {
        for (const item of dbVcData) {
          const ch = item.channel as unknown as { id: number; yt_channel_id: string; name: string; handle: string | null; image: string | null } | null;
          if (!ch) continue;

          const target = collaboratorChannels.find((c) => c.ytChannelId === ch.yt_channel_id || c.channelRecordId === ch.id);
          if (target) {
            target.isRegistered = true;
            target.channelRecordId = ch.id;
          } else {
            collaboratorChannels.push({
              ytChannelId: ch.yt_channel_id,
              name: ch.name,
              handle: ch.handle || undefined,
              avatarUrl: ch.image || undefined,
              description: '',
              isRegistered: true,
              channelRecordId: ch.id,
              isOriginalUploader: item.is_original ?? false,
            });
          }
        }
      }

      // 登録済みの曲と song_channels を取得
      const { data: songsData } = await supabase
        .from('songs')
        .select('*, master_song:master_songs(*)')
        .eq('video_id', videoData.id)
        .order('start_sec', { ascending: true });
      
      if (songsData && songsData.length > 0) {
        const songIds = songsData.map((s) => s.id);
        const { data: scData } = await supabase
          .from('song_channels')
          .select('song_id, channel_id')
          .in('song_id', songIds);

        const scMap = new Map<number, number[]>();
        if (scData) {
          for (const sc of scData) {
            const list = scMap.get(sc.song_id) || [];
            list.push(sc.channel_id);
            scMap.set(sc.song_id, list);
          }
        }

        existingSongs = songsData.map((s) => ({
          ...s,
          channelIds: scMap.get(s.id) || [],
        })) as (Song & { channelIds?: number[] })[];
      }
    }

    return { 
      success: true, 
      data: { 
        metadata, 
        existingSongs,
        isChannelRegistered,
        channelData,
        collaboratorChannels,
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

export interface VtuberWithChannels extends Vtuber {
  channels: Pick<Channel, 'id' | 'name' | 'image' | 'handle' | 'is_primary'>[];
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[\s\-_・/@]/g, '');
}

/**
 * VTuber 名で検索（紐づくチャンネル一覧含む）
 */
export async function searchVtubers(
  query: string
): Promise<ActionResult<VtuberWithChannels[]>> {
  const clean = query.trim();
  if (!clean) {
    return { success: true, data: [] };
  }
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
    const spacedFromCamel = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    const noSpace = clean.replace(/\s+/g, '');

    // 1. vtubers.name での検索
    const { data: vtList, error: vtErr } = await supabase
      .from('vtubers')
      .select(`
        *,
        channels (
          id,
          name,
          image,
          handle,
          is_primary
        )
      `)
      .or(`name.ilike.%${clean}%,name.ilike.%${spacedFromCamel}%`)
      .limit(10);

    if (vtErr) throw vtErr;

    // 2. チャンネル名・ハンドル名からの逆引き検索
    const { data: chanList } = await supabase
      .from('channels')
      .select('vtuber_id')
      .or(`name.ilike.%${clean}%,handle.ilike.%${clean}%,name.ilike.%${noSpace}%,handle.ilike.%${noSpace}%`)
      .not('vtuber_id', 'is', null)
      .limit(10);

    const channelVtuberIds = (chanList || []).map((c) => c.vtuber_id).filter(Boolean) as number[];

    let extraVtList: (Vtuber & { channels: Pick<Channel, 'id' | 'name' | 'image' | 'handle' | 'is_primary'>[] })[] = [];
    if (channelVtuberIds.length > 0) {
      const { data: vtFromChan } = await supabase
        .from('vtubers')
        .select(`
          *,
          channels (
            id,
            name,
            image,
            handle,
            is_primary
          )
        `)
        .in('id', channelVtuberIds);
      extraVtList = (vtFromChan || []) as (Vtuber & { channels: Pick<Channel, 'id' | 'name' | 'image' | 'handle' | 'is_primary'>[] })[];
    }

    const vtuberMap = new Map<number, VtuberWithChannels>();
    [...(vtList || []), ...extraVtList].forEach((vt) => {
      vtuberMap.set(vt.id, {
        ...vt,
        channels: (vt.channels || []) as Pick<Channel, 'id' | 'name' | 'image' | 'handle' | 'is_primary'>[],
      });
    });

    return { success: true, data: Array.from(vtuberMap.values()) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'VTuber検索に失敗しました';
    return { success: false, error: message };
  }
}

/**
 * 新規登録時のVTuber名重複チェック（完全一致 / 類似一致）
 */
export async function checkDuplicateVtuber(
  name: string
): Promise<ActionResult<{
  exactMatch: VtuberWithChannels | null;
  similarMatches: VtuberWithChannels[];
}>> {
  const cleanName = name.trim();
  if (!cleanName) {
    return { success: true, data: { exactMatch: null, similarMatches: [] } };
  }
  try {
    const searchRes = await searchVtubers(cleanName);
    if (!searchRes.success || !searchRes.data) {
      return { success: true, data: { exactMatch: null, similarMatches: [] } };
    }

    const formatted = searchRes.data;
    const normClean = normalizeName(cleanName);

    // 完全一致判定 (名前そのもの、または正規化一致、またはチャンネル名/ハンドル完全一致)
    const exactMatch = formatted.find((vt) => {
      const normVtName = normalizeName(vt.name);
      if (normVtName === normClean || normVtName.includes(normClean) && normClean.length >= 4) {
        return true;
      }
      return vt.channels.some((c) => {
        const normCName = normalizeName(c.name);
        const normCHandle = normalizeName(c.handle || '');
        return normCName === normClean || normCHandle === normClean;
      });
    }) || null;

    const similarMatches = formatted.filter(
      (vt) => !exactMatch || vt.id !== exactMatch.id
    );

    return {
      success: true,
      data: { exactMatch, similarMatches },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'VTuber重複チェックに失敗しました';
    return { success: false, error: message };
  }
}

/**
 * VTuber とチャンネルを一括で登録する
 */
export async function registerVtuberAndChannel(params: {
  existingVtuberId?: number;
  isPrimary?: boolean;
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
    let vtuberId = params.existingVtuberId;

    if (!vtuberId) {
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
      vtuberId = vtuber.id;
      console.log('VTuber registered with ID:', vtuberId);
    }

    const isPrimary = params.isPrimary ?? true;

    // もし isPrimary が true で既存VTuber紐づけの場合、同じ vtuber_id の旧メインチャンネルを is_primary = false に更新
    if (isPrimary && vtuberId) {
      await supabase
        .from('channels')
        .update({ is_primary: false })
        .eq('vtuber_id', vtuberId)
        .eq('is_primary', true);
    }

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
        vtuber_id: vtuberId,
        is_primary: isPrimary,
        created_by: user.id,
      })
      .select('id')
      .single();
    
    if (chanErr) {
      console.error('Channel insert error:', chanErr);
      throw chanErr;
    }
    console.log('Channel registered with ID:', channel.id);

    return { success: true, data: { vtuberId: vtuberId!, channelId: channel.id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.saveError;
    return { success: false, error: message };
  }
}

/**
 * 未登録コラボチャンネルをワンタップで自動登録する（同名 VTuber + チャンネル）
 */
export async function registerQuickCollabChannel(params: {
  ytChannelId: string;
  name: string;
  handle?: string;
  image?: string;
}): Promise<ActionResult<{ vtuberId: number; channelId: number }>> {
  const supabase = await createClient();
  const t = await getLocaleT();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  try {
    // 既存の同 ytChannelId チェック
    const { data: existingChan } = await supabase
      .from('channels')
      .select('id, vtuber_id')
      .eq('yt_channel_id', params.ytChannelId)
      .maybeSingle();

    if (existingChan) {
      return { success: true, data: { vtuberId: existingChan.vtuber_id || 0, channelId: existingChan.id } };
    }

    // VTuber 登録
    const { data: vtuber, error: vtErr } = await supabase
      .from('vtubers')
      .insert({
        name: params.name,
        gender: '不明',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (vtErr) throw vtErr;

    // チャンネル登録
    const { data: channel, error: chanErr } = await supabase
      .from('channels')
      .insert({
        yt_channel_id: params.ytChannelId,
        name: params.name,
        handle: params.handle || null,
        image: params.image || null,
        vtuber_id: vtuber.id,
        is_primary: true,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (chanErr) throw chanErr;

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
  metadata: YouTubeVideoMetadata,
  collaboratorChannelIds?: number[]
): Promise<ActionResult<Video>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  // チャンネルの内部 ID を取得
  const { data: channelRecord } = await supabase
    .from('channels')
    .select('id')
    .eq('yt_channel_id', metadata.channelId)
    .single();

  if (!channelRecord) {
    return { success: false, error: `${t.vtuber.linkedChannel} (ID: ${metadata.channelId}) ${t.archive.noArchives}` };
  }

  let videoDbId: number;
  let videoData: Video;

  // 既存チェック
  const { data: existing } = await supabase
    .from('videos')
    .select('*')
    .eq('video_id', metadata.videoId)
    .single();

  if (existing) {
    videoDbId = existing.id;
    videoData = existing as Video;
  } else {
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
    videoDbId = data.id;
    videoData = data as Video;
  }

  // video_channels に紐づけ（投稿元 + コラボ先）
  const vcInserts = [
    { video_id: videoDbId, channel_id: channelRecord.id, is_original: true }
  ];

  if (collaboratorChannelIds && collaboratorChannelIds.length > 0) {
    for (const cid of collaboratorChannelIds) {
      if (cid !== channelRecord.id) {
        vcInserts.push({ video_id: videoDbId, channel_id: cid, is_original: false });
      }
    }
  }

  await supabase
    .from('video_channels')
    .upsert(vcInserts, { onConflict: 'video_id,channel_id' });

  return { success: true, data: videoData };
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
  channelIds?: number[];
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
    .select('*, master_song:master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.saveError}: ${error.message}` };
  }

  // song_channels に登録
  if (input.channelIds && input.channelIds.length > 0) {
    const scInserts = input.channelIds.map((cid) => ({
      song_id: data.id,
      channel_id: cid,
    }));
    await supabase.from('song_channels').insert(scInserts);
  } else {
    // 親動画の投稿元チャンネルをデフォルト登録
    const { data: vcRecord } = await supabase
      .from('video_channels')
      .select('channel_id')
      .eq('video_id', input.videoDbId)
      .eq('is_original', true)
      .maybeSingle();
    if (vcRecord?.channel_id) {
      await supabase.from('song_channels').insert({
        song_id: data.id,
        channel_id: vcRecord.channel_id,
      });
    }
  }

  await revalidateChannelByVideo(input.videoDbId);
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
    channelIds?: number[];
  }[];
  collaboratorChannelIds?: number[];
}): Promise<ActionResult<{ video: Video; songs: Song[] }>> {
  const supabase = await createClient();
  const t = await getLocaleT();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: t.common.loginRequired };
  }

  try {
    const videoDuration = input.videoMetadata.duration || 0;
    if (videoDuration > 0) {
      for (const s of input.songs) {
        if (!s.isDeleted && s.endSec > videoDuration) {
          return { success: false, error: t.newSong.endTimeExceedsDuration };
        }
      }
    }

    const songsToRegister = [];

    // 1. 各曲について、事前に必要な外部API（iTunes）のデータを取得して整形
    for (const songInput of input.songs) {
      if (songInput.isDeleted) {
        songsToRegister.push({
          id: songInput.id,
          isDeleted: true,
        });
        continue;
      }

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
            titleJa = otherInfo!.trackName;
            artistJa = otherInfo!.artistName;
          } else {
            titleJa = songInput.songTitle.trim();
            artistJa = songInput.songArtist.trim();
            titleEn = otherInfo!.trackName;
            artistEn = otherInfo!.artistName;
          }
        } else {
          if (songInput.searchLocale === 'en') {
            titleEn = songInput.songTitle.trim();
            artistEn = songInput.songArtist.trim();
          }
        }
      }

      songsToRegister.push({
        id: songInput.id,
        titleJa,
        artistJa,
        titleEn,
        artistEn,
        artworkUrl: songInput.artworkUrl || null,
        itunesId: songInput.itunesId ? String(songInput.itunesId) : null,
        durationSec: songInput.durationSec || 0,
        startSec: songInput.startSec,
        endSec: songInput.endSec,
        isDeleted: false,
        channelIds: songInput.channelIds || [],
      });
    }

    // 2. トランザクション保護された RPC を呼び出してDB処理を一括実行
    const { data, error } = await supabase.rpc('register_full_archive_transaction', {
      p_video_id: input.videoMetadata.videoId,
      p_video_title: input.videoMetadata.title,
      p_video_description: input.videoMetadata.description,
      p_video_thumbnail_url: input.videoMetadata.thumbnailUrl,
      p_video_published_at: input.videoMetadata.publishedAt,
      p_video_duration: input.videoMetadata.duration,
      p_video_is_stream: input.videoMetadata.isStream,
      p_channel_yt_id: input.videoMetadata.channelId,
      p_songs: songsToRegister,
      p_collaborator_channel_ids: input.collaboratorChannelIds || [],
    });

    if (error) {
      throw new Error(`${t.common.saveError}: ${error.message}`);
    }

    // RPC から返却された型付き JSON データをマッピングして返却
    const result = data as { video: Video; songs: Song[] };
    if (result.video) {
      await revalidateChannelByVideo(result.video.id);
      // コラボチャンネルのページキャッシュも個別に再検証
      if (input.collaboratorChannelIds && input.collaboratorChannelIds.length > 0) {
        for (const collabId of input.collaboratorChannelIds) {
          await revalidateChannel(collabId);
        }
      }
    }
    return { success: true, data: result };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.saveError;
    return { success: false, error: message };
  }
}

/**
 * 安全に decodeURIComponent を実行するヘルパー
 */
function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export interface SubChannelInfo {
  id: number;
  name: string;
  videoCount: number;
}

export type ChannelWithVideosResult = Channel & {
  vtuber?: Vtuber & { production?: Production };
  videos: (Video & { songs: Song[]; sourceChannelName?: string; isCollab?: boolean; originalChannelName?: string })[];
  subChannels?: SubChannelInfo[];
  redirectTo?: string;
};

/**
 * チャンネル詳細と紐付く動画・曲リストを取得する (ID またはハンドルに対応)
 */
export async function fetchChannelWithVideosFromDb(identifier: string | number): Promise<ActionResult<ChannelWithVideosResult>> {
  console.log('fetchChannelWithVideosFromDb called with identifier:', identifier);
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
  const t = translations['ja'];

  const rawStr = String(identifier).trim();
  const decodedStr = safeDecode(rawStr).trim();
  const isNumeric = /^\d+$/.test(decodedStr);

  let query = supabase
    .from('channels')
    .select(`
      *,
      vtuber:vtubers (
        *,
        production:productions (*)
      )
    `);

  if (isNumeric) {
    // 数値 ID で検索
    const channelId = Number(decodedStr);
    query = query.eq('id', channelId);
  } else {
    // ハンドルで検索 (DB の handle は @ 付きで格納されている)
    const handleWithAt = decodedStr.startsWith('@') ? decodedStr : `@${decodedStr}`;
    query = query.ilike('handle', handleWithAt);
  }

  const { data: channels, error: chanErr } = await query.limit(1);
  const channel = channels?.[0];

  if (chanErr || !channel) {
    if (!isNumeric) {
      const cleanSearchName = decodedStr.replace(/^@/, '').trim();
      
      // 1. チャンネル名・ハンドル名でのフォールバック検索
      const { data: fallbackChannels } = await supabase
        .from('channels')
        .select(`
          *,
          vtuber:vtubers (
            *,
            production:productions (*)
          )
        `)
        .or(`name.ilike.%${cleanSearchName}%,handle.ilike.%${cleanSearchName}%`)
        .limit(1);

      let fallbackChannel = fallbackChannels?.[0];

      // 2. VTuber 名からの逆引き検索
      if (!fallbackChannel && cleanSearchName) {
        const { data: vtList } = await supabase
          .from('vtubers')
          .select('id')
          .ilike('name', `%${cleanSearchName}%`)
          .limit(1);

        if (vtList && vtList.length > 0) {
          const { data: vtChanList } = await supabase
            .from('channels')
            .select(`
              *,
              vtuber:vtubers (
                *,
                production:productions (*)
              )
            `)
            .eq('vtuber_id', vtList[0].id)
            .or('is_primary.eq.true,is_primary.is.null')
            .limit(1);
          fallbackChannel = vtChanList?.[0];
        }
      }

      if (fallbackChannel) {
        return fetchVideosForChannel(fallbackChannel as Channel, supabase);
      }
    }
    return { success: false, error: t.archive.notFound };
  }

  return fetchVideosForChannel(channel as Channel, supabase);
}

function toSafeCacheKey(identifier: string | number): string {
  return Buffer.from(String(identifier)).toString('hex');
}

const getChannelWithVideosCached = unstable_cache(
  async (_safeKey: string, rawIdentifier: string | number) => {
    return fetchChannelWithVideosFromDb(rawIdentifier);
  },
  ['channel-with-videos-safe-cached'],
  {
    revalidate: 3600, // 1時間キャッシュ
    tags: ['channel-details']
  }
);

export async function getChannelWithVideos(identifier: string | number) {
  const safeKey = toSafeCacheKey(identifier);
  return getChannelWithVideosCached(safeKey, identifier);
}

/**
 * チャンネルの基本情報（メタデータ生成用）のみを取得する (ID またはハンドルに対応)
 */
export async function fetchChannelMetadataFromDb(identifier: string | number): Promise<ActionResult<Channel & { vtuber?: Vtuber & { production?: Production } | null }>> {
  console.log('fetchChannelMetadataFromDb called with identifier:', identifier);
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );
  const t = translations['ja'];

  const rawStr = String(identifier).trim();
  const decodedStr = safeDecode(rawStr).trim();
  const isNumeric = /^\d+$/.test(decodedStr);

  let query = supabase
    .from('channels')
    .select(`
      *,
      vtuber:vtubers (
        *,
        production:productions (*)
      )
    `);

  if (isNumeric) {
    // 数値 ID で検索
    const channelId = Number(decodedStr);
    query = query.eq('id', channelId);
  } else {
    // ハンドルで検索 (DB の handle は @ 付きで格納されている)
    const handleWithAt = decodedStr.startsWith('@') ? decodedStr : `@${decodedStr}`;
    query = query.ilike('handle', handleWithAt);
  }

  const { data: channels, error: chanErr } = await query.limit(1);
  const channel = channels?.[0];

  if (chanErr || !channel) {
    if (!isNumeric) {
      const cleanSearchName = decodedStr.replace(/^@/, '').trim();
      
      const { data: fallbackChannels } = await supabase
        .from('channels')
        .select(`
          *,
          vtuber:vtubers (
            *,
            production:productions (*)
          )
        `)
        .or(`name.ilike.%${cleanSearchName}%,handle.ilike.%${cleanSearchName}%`)
        .limit(1);

      let fallbackChannel = fallbackChannels?.[0];

      if (!fallbackChannel && cleanSearchName) {
        const { data: vtList } = await supabase
          .from('vtubers')
          .select('id')
          .ilike('name', `%${cleanSearchName}%`)
          .limit(1);

        if (vtList && vtList.length > 0) {
          const { data: vtChanList } = await supabase
            .from('channels')
            .select(`
              *,
              vtuber:vtubers (
                *,
                production:productions (*)
              )
            `)
            .eq('vtuber_id', vtList[0].id)
            .or('is_primary.eq.true,is_primary.is.null')
            .limit(1);
          fallbackChannel = vtChanList?.[0];
        }
      }

      if (fallbackChannel) {
        return { success: true, data: fallbackChannel as unknown as Channel & { vtuber?: Vtuber & { production?: Production } | null } };
      }
    }
    return { success: false, error: t.archive.notFound };
  }

  return { success: true, data: channel as unknown as Channel & { vtuber?: Vtuber & { production?: Production } | null } };
}

const getChannelMetadataCached = unstable_cache(
  async (_safeKey: string, rawIdentifier: string | number) => {
    return fetchChannelMetadataFromDb(rawIdentifier);
  },
  ['channel-metadata-safe-cached'],
  {
    revalidate: 3600, // 1時間キャッシュ
    tags: ['channel-details']
  }
);

export async function getChannelMetadata(identifier: string | number) {
  const safeKey = toSafeCacheKey(identifier);
  return getChannelMetadataCached(safeKey, identifier);
}

/**
 * チャンネルのキャッシュを再検証（パージ）する
 */
export async function revalidateChannel(channelRecordId: number | null): Promise<void> {
  if (channelRecordId === null) return;
  console.log('revalidateChannel called for channelRecordId:', channelRecordId);
  try {
    const supabase = await createClient();
    const { data: channel } = await supabase
      .from('channels')
      .select('handle, vtuber_id, is_primary')
      .eq('id', channelRecordId)
      .single();

    // 1. ID でのパスを再検証
    console.log(`[ISR] Revalidating ID path: /channels/${channelRecordId}`);
    revalidatePath(`/channels/${channelRecordId}`);

    // もしサブ/トピックチャンネルの場合、統合先のメインチャンネルのページも連動再検証
    if (channel && channel.is_primary === false && channel.vtuber_id) {
      const { data: primaryChan } = await supabase
        .from('channels')
        .select('id, handle')
        .eq('vtuber_id', channel.vtuber_id)
        .or('is_primary.eq.true,is_primary.is.null')
        .neq('id', channelRecordId)
        .limit(1)
        .maybeSingle();

      if (primaryChan) {
        console.log(`[ISR] Revalidating Primary channel path for sub-channel: /channels/${primaryChan.id}`);
        revalidatePath(`/channels/${primaryChan.id}`);
        if (primaryChan.handle) {
          revalidatePath(`/channels/${primaryChan.handle}`);
        }
      }
    }

    // 2. ハンドルでのパスを再検証 (存在する場合)
    if (channel?.handle) {
      // エンコードされたハンドル名用 (例: /channels/%40nekomashiroa)
      const encodedHandlePath = `/channels/${encodeURIComponent(channel.handle)}`;
      console.log(`[ISR] Revalidating handle path (encoded): ${encodedHandlePath}`);
      revalidatePath(encodedHandlePath);

      // 生のハンドル名用 (例: /channels/@nekomashiroa)
      const rawHandlePath = `/channels/${channel.handle}`;
      console.log(`[ISR] Revalidating handle path (raw): ${rawHandlePath}`);
      revalidatePath(rawHandlePath);
      
      const cleanHandle = channel.handle.replace('@', '');
      if (cleanHandle !== channel.handle) {
        const cleanHandlePath = `/channels/${encodeURIComponent(cleanHandle)}`;
        console.log(`[ISR] Revalidating clean handle path: ${cleanHandlePath}`);
        revalidatePath(cleanHandlePath);
      }
    }

    // 3. トップページおよび最近追加ページ（/recently）のキャッシュを再検証
    console.log(`[ISR] Revalidating Home and Recently paths, and home-videos tag`);
    revalidatePath('/');
    revalidatePath('/recently');
    revalidateTag('home-videos', 'max');

    // 4. チャンネル一覧ページのキャッシュを再検証
    console.log(`[ISR] Revalidating Channels list path and tag`);
    revalidatePath('/channels');
    revalidateTag('channels-list', 'max');

    // 5. チャンネル詳細データのキャッシュをパージ
    console.log(`[ISR] Revalidating unstable_cache tag: channel-details`);
    revalidateTag('channel-details', 'max');
  } catch (e) {
    console.error('Failed to revalidate channel pages:', e);
  }
}

/**
 * 動画IDから関連するチャンネルのキャッシュを再検証（パージ）する
 */
export async function revalidateChannelByVideo(videoDbId: number): Promise<void> {
  console.log('revalidateChannelByVideo called for videoDbId:', videoDbId);
  try {
    const supabase = await createClient();
    const { data: vChannels } = await supabase
      .from('video_channels')
      .select('channel_id')
      .eq('video_id', videoDbId);

    if (vChannels) {
      for (const vc of vChannels) {
        await revalidateChannel(vc.channel_id);
      }
    }

    const { data: video } = await supabase
      .from('videos')
      .select('video_id')
      .eq('id', videoDbId)
      .single();

    if (video && video.video_id) {
      const videoPath = `/videos/${video.video_id}`;
      console.log(`[ISR] Revalidating video path: ${videoPath}`);
      revalidatePath(videoPath);

      const videoOgPath = `/videos/${video.video_id}/og`;
      console.log(`[ISR] Revalidating video OG path: ${videoOgPath}`);
        revalidatePath(videoOgPath);

        console.log('[ISR] Revalidating unstable_cache tag: video-details');
        revalidateTag('video-details', 'max');
      }
  } catch (e) {
    console.error('Failed to revalidate channel by video:', e);
  }
}

/**
 * 静的生成用に全動画のIDを取得する (クッキーなし)
 */
export async function getVideosForStatic(): Promise<ActionResult<{ video_id: string }[]>> {
  console.log('getVideosForStatic called');
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  const { data, error } = await supabase
    .from('videos')
    .select('video_id')
    .eq('is_publish', true);

  if (error) {
    console.error('getVideosForStatic error:', error);
    return { success: false, error: 'Failed to fetch video ids for static rendering' };
  }

  return { success: true, data: data || [] };
}

/**
 * 内部補助関数: チャンネルに紐付く動画と曲をまとめて取得・マッピングする (サブ/トピック含む)
 */
async function fetchVideosForChannel(channel: Channel, supabase: SupabaseClient): Promise<ActionResult<ChannelWithVideosResult>> {
  const t = translations['ja'];

  // 1. is_primary が false (サブ/トピックチャンネル) の場合、メインチャンネルへのリダイレクト確認
  if ((channel.is_primary === false || (channel.is_primary as unknown) === 'false') && channel.vtuber_id) {
    const { data: primaryChans } = await supabase
      .from('channels')
      .select('id, handle')
      .eq('vtuber_id', channel.vtuber_id)
      .or('is_primary.eq.true,is_primary.is.null')
      .neq('id', channel.id)
      .limit(1);
    const primaryChan = primaryChans?.[0];

    if (primaryChan && primaryChan.id !== channel.id) {
      const redirectToPath = getChannelUrl(primaryChan);

      // 自分自身への循環リダイレクトを防御
      const currentNumericPath = `/channels/${channel.id}`;
      const currentHandlePath = channel.handle ? `/channels/${channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`}` : null;

      if (redirectToPath !== currentNumericPath && (currentHandlePath ? redirectToPath !== currentHandlePath : true)) {
        return {
          success: true,
          data: {
            ...channel,
            videos: [],
            redirectTo: redirectToPath
          }
        };
      }
    }
  }

  // 2. 関連する全チャンネル（同じ vtuber_id）を取得
  let relatedChannels: Channel[] = [channel];
  if (channel.vtuber_id) {
    const { data: rels } = await supabase
      .from('channels')
      .select('*')
      .eq('vtuber_id', channel.vtuber_id);

    if (rels && rels.length > 0) {
      relatedChannels = rels as Channel[];
    }
  }

  const channelMap = new Map<number, Channel>();
  relatedChannels.forEach((c) => channelMap.set(c.id, c));
  const channelIds = relatedChannels.map((c) => c.id);

  // 1. video_channels から関連する全動画IDとオリジナル情報を取得
  const { data: videoChanRecords } = await supabase
    .from('video_channels')
    .select('video_id, channel_id, is_original')
    .in('channel_id', channelIds);

  const collabVideoMap = new Map<number, boolean>();
  const originalChannelMap = new Map<number, number>();
  const allTargetVideoIds: number[] = [];

  if (videoChanRecords && videoChanRecords.length > 0) {
    videoChanRecords.forEach((r) => {
      allTargetVideoIds.push(r.video_id);
      if (r.is_original) {
        originalChannelMap.set(r.video_id, r.channel_id);
      } else {
        collabVideoMap.set(r.video_id, true);
      }
    });
  }

  const uniqueVideoIds = Array.from(new Set(allTargetVideoIds));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let videos: any[] = [];
  if (uniqueVideoIds.length > 0) {
    const { data: vidData, error: vidErr } = await supabase
      .from('videos')
      .select(`
        id,
        video_id,
        title,
        thumbnail_url,
        published_at,
        duration,
        is_stream,
        video_channels (
          channel_id,
          is_original,
          channel:channels (
            id,
            name
          )
        ),
        songs (
          id,
          video_id,
          start_sec,
          end_sec,
          is_active,
          master_song_id,
          master_song:master_songs (
            id,
            title,
            artist,
            title_en,
            artist_en,
            artwork_url
          )
        )
      `)
      .in('id', uniqueVideoIds)
      .order('published_at', { ascending: false });

    if (vidErr) {
      console.error('fetchVideosForChannel error:', vidErr);
      return { success: false, error: `${t.common.errorOccurred} (videos)` };
    }
    videos = vidData || [];
  }

  // 全動画に含まれる全曲の ID を収集して song_channels を一括フェッチ
  const allSongIds: number[] = [];
  (videos || []).forEach((v) => {
    (v.songs || []).forEach((s: { id: number }) => {
      if (s.id) allSongIds.push(s.id);
    });
  });

  const songSingersMap = new Map<number, Channel[]>();
  if (allSongIds.length > 0) {
    const { data: scData } = await supabase
      .from('song_channels')
      .select('song_id, channel:channels(*)')
      .in('song_id', allSongIds);

    if (scData) {
      for (const sc of scData) {
        const ch = sc.channel as unknown as Channel | null;
        if (!ch) continue;
        const list = songSingersMap.get(sc.song_id) || [];
        list.push(ch);
        songSingersMap.set(sc.song_id, list);
      }
    }
  }

  // サブチャンネルごとの動画件数をカウント
  const subChannelCountMap = new Map<number, number>();

  // songs のうち is_active なもののみを抽出・マッピングし、開始時間の昇順でソートする
  type SongItem = { id: number; is_active?: boolean; start_sec?: number };
  const processedVideos = (videos || []).map((video) => {
    const activeSongs = (video.songs || [])
      .filter((song: SongItem) => song.is_active !== false)
      .sort((a: SongItem, b: SongItem) => (a.start_sec || 0) - (b.start_sec || 0))
      .map((song: SongItem) => ({
        ...song,
        singers: songSingersMap.get(song.id) || [],
      }));

    const origChanId = originalChannelMap.get(video.id) ?? video.channel_record_id;
    const sourceChan = origChanId ? channelMap.get(origChanId) : undefined;
    const isMainChannel = origChanId === channel.id;
    const isCollab = collabVideoMap.has(video.id) || (!isMainChannel && !sourceChan);

    if (!isMainChannel && origChanId && sourceChan) {
      subChannelCountMap.set(
        origChanId,
        (subChannelCountMap.get(origChanId) || 0) + 1
      );
    }

    // 動画の投稿元チャンネル名（コラボ動画の表示用）
    const origVc = (video.video_channels as { channel_id: number; is_original: boolean; channel?: { name: string } }[])?.find((vc) => vc.is_original);
    const originalChannelName = origVc?.channel?.name || sourceChan?.name;

    return {
      ...video,
      channel_record_id: origChanId,
      songs: activeSongs,
      isCollab,
      originalChannelName: isCollab ? originalChannelName : undefined,
      sourceChannelName: !isMainChannel && sourceChan ? sourceChan.name : undefined,
    };
  });

  // サブチャンネル情報の作成
  const subChannelsInfo: SubChannelInfo[] = relatedChannels
    .filter((c) => c.id !== channel.id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      videoCount: subChannelCountMap.get(c.id) || 0,
    }));

  return {
    success: true,
    data: {
      ...channel,
      videos: processedVideos as unknown as (Video & { songs: Song[]; sourceChannelName?: string })[],
      subChannels: subChannelsInfo.length > 0 ? subChannelsInfo : undefined,
    }
  };
}

/**
 * 曲の区間情報を更新する
 */
export async function updateSong(input: {
  songId: number;
  startTime: string;
  endTime: string;
  channelIds?: number[];
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
    .select('*, master_song:master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.updateError}: ${error.message}` };
  }

  if (input.channelIds !== undefined) {
    await supabase.from('song_channels').delete().eq('song_id', input.songId);
    if (input.channelIds.length > 0) {
      const scInserts = input.channelIds.map((cid) => ({
        song_id: input.songId,
        channel_id: cid,
      }));
      await supabase.from('song_channels').insert(scInserts);
    }
  }

  await revalidateChannelByVideo(data.video_id);
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
    .select('*, master_song:master_songs(*)')
    .single();

  if (error) {
    return { success: false, error: `${t.common.updateError}: ${error.message}` };
  }

  await revalidateChannelByVideo(data.video_id);
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

  const { data, error } = await supabase
    .from('songs')
    .update({ is_active: false })
    .eq('id', songId)
    .select('video_id')
    .single();

  if (error) {
    return { success: false, error: `${t.common.deleteError}: ${error.message}` };
  }

  if (data) {
    await revalidateChannelByVideo(data.video_id);
  }

  return { success: true, data: null };
}

/**
 * GoogleスプレッドシートのURLからCSVデータをサーバーサイドで取得する
 */
export async function fetchSpreadsheetCsvAction(
  gsUrl: string
): Promise<ActionResult<string>> {
  const t = await getLocaleT();
  if (!gsUrl.trim()) {
    return { success: false, error: 'URLが入力されていません。' };
  }

  console.log(`[fetchSpreadsheetCsvAction] Input URL: ${gsUrl}`);

  try {
    const csvUrl = convertGSheetUrlToCsv(gsUrl);
    console.log(`[fetchSpreadsheetCsvAction] Converted CSV URL: ${csvUrl}`);

    const response = await fetch(csvUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv,text/plain',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      cache: 'no-store'
    });

    console.log(`[fetchSpreadsheetCsvAction] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error(`[fetchSpreadsheetCsvAction] Failed to fetch. Status: ${response.status}, Body: ${errorText.substring(0, 500)}`);
      return { 
        success: false, 
        error: `スプレッドシートの取得に失敗しました (Status: ${response.status})。共有設定を確認してください。` 
      };
    }

    const text = await response.text();
    return { success: true, data: text };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.errorOccurred;
    console.error(`[fetchSpreadsheetCsvAction] Exception occurred:`, e);
    return { success: false, error: `例外が発生しました: ${message}` };
  }
}

/**
 * 概要欄から YouTube チャンネルリンク/ハンドルを自動抽出し、メタデータとDB登録状況を返す
 */
export async function extractChannelsFromDescription(
  description: string,
  existingYtChannelIds: string[] = []
): Promise<ActionResult<CollaboratorChannelPreview[]>> {
  const t = await getLocaleT();
  if (!description || !description.trim()) {
    return { success: true, data: [] };
  }

  try {
    const existingSet = new Set(existingYtChannelIds);
    const foundYtChannelIds = new Set<string>();
    const foundHandles = new Set<string>();

    // 1. YouTube チャンネル URL / ID パターン
    // https://www.youtube.com/channel/UC...
    const channelIdRegex = /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/gi;
    let match: RegExpExecArray | null;
    while ((match = channelIdRegex.exec(description)) !== null) {
      const id = match[1];
      if (!existingSet.has(id)) {
        foundYtChannelIds.add(id);
      }
    }

    // 2. YouTube ハンドル URL / @メンション パターン
    // https://www.youtube.com/@handle or @handle
    const handleUrlRegex = /(?:youtube\.com\/@|@)([a-zA-Z0-9._-]{3,30})/gi;
    while ((match = handleUrlRegex.exec(description)) !== null) {
      const handle = `@${match[1]}`;
      foundHandles.add(handle.toLowerCase());
    }

    // メタデータマップ
    const channelMetaMap = new Map<string, {
      ytChannelId: string;
      name: string;
      handle?: string;
      avatarUrl?: string;
      description?: string;
    }>();

    // チャンネルID群をメタデータ一括取得
    if (foundYtChannelIds.size > 0) {
      const metaMap = await fetchMultipleChannelsMetadata(Array.from(foundYtChannelIds));
      metaMap.forEach((meta, id) => {
        channelMetaMap.set(id, {
          ytChannelId: id,
          name: meta.name,
          handle: meta.handle,
          avatarUrl: meta.image,
          description: meta.description,
        });
      });
    }

    // ハンドル群を個別取得（すでに取得済みのIDに対応するハンドルは除外）
    const alreadyFetchedHandles = new Set(
      Array.from(channelMetaMap.values())
        .map((m) => m.handle?.toLowerCase())
        .filter(Boolean)
    );

    for (const handle of Array.from(foundHandles)) {
      if (alreadyFetchedHandles.has(handle)) continue;
      try {
        const meta = await fetchChannelByHandle(handle);
        if (meta && !existingSet.has(meta.ytChannelId)) {
          channelMetaMap.set(meta.ytChannelId, {
            ytChannelId: meta.ytChannelId,
            name: meta.name,
            handle: meta.handle,
            avatarUrl: meta.image,
            description: meta.description,
          });
        }
      } catch (_err) {
        // ハンドルが見つからない場合はスキップ
      }
    }

    if (channelMetaMap.size === 0) {
      return { success: true, data: [] };
    }

    const allIds = Array.from(channelMetaMap.keys());
    const supabase = await createClient();
    const { data: registeredChannels } = await supabase
      .from('channels')
      .select('id, yt_channel_id, name, handle, image')
      .in('yt_channel_id', allIds);

    const regMap = new Map<string, { id: number; name: string; handle: string | null; image: string | null }>();
    (registeredChannels || []).forEach((c) => regMap.set(c.yt_channel_id, c));

    const result: CollaboratorChannelPreview[] = [];
    channelMetaMap.forEach((meta, ytId) => {
      const reg = regMap.get(ytId);
      result.push({
        ytChannelId: ytId,
        name: reg?.name || meta.name,
        handle: reg?.handle || meta.handle,
        avatarUrl: reg?.image || meta.avatarUrl,
        description: meta.description,
        isRegistered: !!reg,
        channelRecordId: reg?.id,
        isOriginalUploader: false,
      });
    });

    return { success: true, data: result };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.errorOccurred;
    return { success: false, error: message };
  }
}

/**
 * 手動入力された チャンネルURL / @ハンドル / チャンネルID(UC...) を解析・取得する
 */
export async function resolveChannelByInput(
  input: string,
  existingYtChannelIds: string[] = []
): Promise<ActionResult<CollaboratorChannelPreview>> {
  const t = await getLocaleT();
  const cleanInput = input.trim();
  if (!cleanInput) {
    return { success: false, error: t.newSong.inputEmpty };
  }

  try {
    let ytChannelId: string | null = null;
    let handle: string | null = null;

    // 1. チャンネルID判定 (UCから始まる24文字)
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(cleanInput)) {
      ytChannelId = cleanInput;
    } else {
      // 2. URLからの抽出
      const channelIdMatch = cleanInput.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/i);
      if (channelIdMatch) {
        ytChannelId = channelIdMatch[1];
      } else {
        const handleMatch = cleanInput.match(/(?:youtube\.com\/@|@)([a-zA-Z0-9._-]{3,30})/i);
        if (handleMatch) {
          handle = `@${handleMatch[1]}`;
        } else if (/^[a-zA-Z0-9._-]{3,30}$/.test(cleanInput)) {
          // 単体文字列の場合、ハンドルとして解釈
          handle = `@${cleanInput}`;
        }
      }
    }

    if (existingYtChannelIds.includes(ytChannelId || '')) {
      return { success: false, error: t.newSong.alreadyAdded };
    }

    let meta: {
      ytChannelId: string;
      name: string;
      handle: string;
      description: string;
      image: string;
    } | null = null;

    if (ytChannelId) {
      meta = await fetchChannelMetadata(ytChannelId);
    } else if (handle) {
      meta = await fetchChannelByHandle(handle);
    }

    if (!meta) {
      return { success: false, error: t.newSong.channelNotFound };
    }

    if (existingYtChannelIds.includes(meta.ytChannelId)) {
      return { success: false, error: t.newSong.alreadyAdded };
    }

    const supabase = await createClient();
    const { data: reg } = await supabase
      .from('channels')
      .select('id, name, handle, image')
      .eq('yt_channel_id', meta.ytChannelId)
      .maybeSingle();

    return {
      success: true,
      data: {
        ytChannelId: meta.ytChannelId,
        name: reg?.name || meta.name,
        handle: reg?.handle || meta.handle,
        avatarUrl: reg?.image || meta.image,
        description: meta.description,
        isRegistered: !!reg,
        channelRecordId: reg?.id,
        isOriginalUploader: false,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : t.common.errorOccurred;
    return { success: false, error: message };
  }
}

