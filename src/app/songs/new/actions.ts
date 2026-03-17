'use server';

import { createClient } from '@/utils/supabase/server';
import { extractVideoId, fetchVideoMetadata, fetchChannelMetadata } from '@/lib/youtube';
import { searchTracks as itunesSearch, getHighResArtwork } from '@/lib/itunes';
import type { Video, Song, YouTubeVideoMetadata, Channel, Production } from '@/types';

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
  query: string
): Promise<ActionResult<ITunesSearchResult[]>> {
  if (!query.trim()) {
    return { success: false, error: '検索キーワードを入力してください' };
  }

  try {
    const tracks = await itunesSearch(query, 10);
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
    const message = e instanceof Error ? e.message : '曲の検索に失敗しました';
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
  if (!videoId) {
    return { success: false, error: '有効な YouTube URL を入力してください' };
  }

  try {
    const metadata = await fetchVideoMetadata(videoId);
    if (!metadata) {
      return { success: false, error: '動画が見つかりません' };
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
    const message = e instanceof Error ? e.message : 'データの取得に失敗しました';
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
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
    const message = e instanceof Error ? e.message : '登録に失敗しました';
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
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
    return { success: false, error: `チャンネル (ID: ${metadata.channelId}) が登録されていません。先にチャンネルを登録してください。` };
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
    return { success: false, error: `動画の登録に失敗しました: ${error.message}` };
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
}): Promise<ActionResult<Song>> {
  // バリデーション
  if (!input.songTitle.trim()) {
    return { success: false, error: '曲を選択してください' };
  }

  const startSec = parseTimeToSeconds(input.startTime);
  const endSec = parseTimeToSeconds(input.endTime);

  if (startSec === null) {
    return { success: false, error: '開始時間の形式が正しくありません（mm:ss）' };
  }
  if (endSec === null) {
    return { success: false, error: '終了時間の形式が正しくありません（mm:ss）' };
  }
  if (startSec >= endSec) {
    return { success: false, error: '終了時間は開始時間より後にしてください' };
  }
  if (endSec - startSec < 10) {
    return { success: false, error: '区間は10秒以上にしてください' };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  // master_songs の存在チェック（曲名+アーティスト名で名寄せ）
  let { data: masterSong, error: masterSearchError } = await supabase
    .from('master_songs')
    .select()
    .eq('title', input.songTitle.trim())
    .eq('artist', input.songArtist.trim() || 'Unknown')
    .maybeSingle();

  if (masterSearchError) {
    return { success: false, error: `原曲情報の検索に失敗しました: ${masterSearchError.message}` };
  }

  // 存在しない場合は新規登録
  if (!masterSong) {
    const { data: newMaster, error: masterInsertError } = await supabase
      .from('master_songs')
      .insert({
        title: input.songTitle.trim(),
        artist: input.songArtist.trim() || 'Unknown',
        artwork_url: input.artworkUrl || null,
        itunes_id: input.itunesId ? String(input.itunesId) : null,
        duration_sec: input.durationSec > 0 ? input.durationSec : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (masterInsertError) {
      return { success: false, error: `原曲情報の登録に失敗しました: ${masterInsertError.message}` };
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
    return { success: false, error: `曲の登録に失敗しました: ${error.message}` };
  }

  return { success: true, data: data as Song };
}

/**
 * 動画情報と曲リストをまとめて一括登録・更新する
 */
export async function registerFullArchive(input: {
  videoMetadata: YouTubeVideoMetadata;
  songs: {
    id?: number; // 既存曲の場合は ID がある
    songTitle: string;
    songArtist: string;
    artworkUrl: string;
    itunesId: string;
    durationSec: number;
    startSec: number;
    endSec: number;
    isDeleted?: boolean;
  }[];
}): Promise<ActionResult<{ video: Video; songs: Song[] }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'ログインが必要です' };
  }

  try {
    // 1. 動画の登録/取得
    const videoResult = await registerVideo(input.videoMetadata);
    if (!videoResult.success) return { success: false, error: videoResult.error };
    const video = videoResult.data;

    const finalSongs: Song[] = [];

    // 2. 曲の処理（ループで回すが、本来はストアドプロシージャなどで一気にやるのが理想）
    for (const songInput of input.songs) {
      if (songInput.isDeleted) {
        if (songInput.id) {
          // 既存曲かつ削除フラグなら削除
          const { error } = await supabase.from('songs').delete().eq('id', songInput.id);
          if (error) throw new Error(`曲の削除に失敗しました: ${error.message}`);
        }
        continue;
      }

      // master_songs の存在チェック
      let { data: masterSong, error: masterSearchError } = await supabase
        .from('master_songs')
        .select()
        .eq('title', songInput.songTitle.trim())
        .eq('artist', songInput.songArtist.trim() || 'Unknown')
        .maybeSingle();
      
      if (masterSearchError) throw new Error(`原曲情報の検索に失敗しました: ${masterSearchError.message}`);

      if (!masterSong) {
        // 存在しない場合は新規登録
        const { data: newMaster, error: masterInsertError } = await supabase
          .from('master_songs')
          .insert({
            title: songInput.songTitle.trim(),
            artist: songInput.songArtist.trim() || 'Unknown',
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
    const message = e instanceof Error ? e.message : '一括登録に失敗しました';
    return { success: false, error: message };
  }
}

/**
 * チャンネル詳細と紐付く動画・曲リストを取得する (ID またはハンドルに対応)
 */
export async function getChannelWithVideos(identifier: string | number): Promise<ActionResult<Channel & { videos: (Video & { songs: Song[] })[] }>> {
  console.log('getChannelWithVideos called with identifier:', identifier);
  const supabase = await createClient();

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
    return { success: false, error: 'チャンネルが見つかりませんでした' };
  }

  return fetchVideosForChannel(channel, supabase);
}

/**
 * 内部補助関数: チャンネルに紐付く動画と曲をまとめて取得・マッピングする
 */
async function fetchVideosForChannel(channel: any, supabase: any): Promise<ActionResult<any>> {
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
    return { success: false, error: '動画リストの取得に失敗しました' };
  }

  return {
    success: true,
    data: {
      ...channel,
      videos: (videos || []) as (Video & { songs: Song[] })[]
    }
  };
}
