'use server';

import { createClient } from '@/utils/supabase/server';
import type { PlayerSong, Song, MasterSong, Video, Channel } from '@/types';
import type { RankingResult } from '@/app/history/actions';

interface LastFmTrack {
  name: string;
  artist?: string | { name: string };
}

type PopulatedSong = Song & {
  master_song: MasterSong | null;
  video: (Video & { channel: Channel | null }) | null;
};

// 配列をランダムにシャッフルするユーティリティ (Fisher-Yates アルゴリズム)
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Last.fm から類似曲（タイトルとアーティスト）を取得する関数
async function fetchSimilarTracksFromLastFm(
  title: string,
  artist: string,
  limit = 20
): Promise<{ title: string; artist: string }[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.log('[Last.fm] API key not found in environment variables. Skipping Last.fm recommendation.');
    return [];
  }

  const url = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(
    artist
  )}&track=${encodeURIComponent(title)}&api_key=${apiKey}&format=json&limit=${limit}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24時間キャッシュ
    if (!res.ok) {
      console.warn(`[Last.fm] API response not OK: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const tracks = data.similartracks?.track || [];
    
    if (!Array.isArray(tracks)) return [];

    return (tracks as LastFmTrack[]).map((t) => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
    }));
  } catch (e) {
    console.error('[Last.fm] Failed to fetch similar tracks:', e);
    return [];
  }
}

// 楽曲モデルから PlayerSong へのマッピングヘルパー
function mapToPlayerSong(song: PopulatedSong): PlayerSong {
  const master = song.master_song;
  const video = song.video;
  const channel = video?.channel;

  return {
    id: song.id,
    title: master?.title || 'Unknown',
    artist: master?.artist || null,
    title_en: master?.title_en || null,
    artist_en: master?.artist_en || null,
    artworkUrl: master?.artwork_url || null,
    videoId: video?.video_id || '',
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: channel?.name || 'Unknown',
    channelThumbnailUrl: channel?.image || null,
    thumbnailUrl: video?.thumbnail_url || null,
    videoTitle: video?.title || null,
  };
}

/**
 * 指定した楽曲に関連する楽曲リストを決定・取得する
 */
export async function getRelatedSongs(
  songId: number,
  excludeIds: number[] = [],
  limit = 20
): Promise<PlayerSong[]> {
  const supabase = await createClient();

  // 1. 基点となる曲の情報を取得
  const { data: baseSong, error: baseErr } = await supabase
    .from('songs')
    .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
    .eq('id', songId)
    .single();

  if (baseErr || !baseSong) {
    console.error('[Recommend] Base song not found:', baseErr);
    return [];
  }

  const masterSong = baseSong.master_song;
  const video = baseSong.video as unknown as (Video & { channel: Channel | null });
  const channelRecordId = video?.channel_record_id;

  // 除外対象のIDリストをユニークにする（自身 + 指定された除外ID）
  let currentExcludes = Array.from(new Set([songId, ...excludeIds]));
  let recommendedSongs: PopulatedSong[] = [];

  // --- A. Last.fm API を使った類似曲の取得 ---
  if (masterSong?.title && masterSong?.artist) {
    console.log(`[Recommend] Fetching Last.fm similar tracks for: "${masterSong.title}" by ${masterSong.artist}`);
    const similarTracks = await fetchSimilarTracksFromLastFm(masterSong.title, masterSong.artist, limit);
    
    if (similarTracks.length > 0) {
      // 類似曲をカバーしている曲をDBから検索
      for (const track of similarTracks) {
        if (recommendedSongs.length >= limit) break;

        // まず類似する master_songs を検索
        const { data: matchedMasters } = await supabase
          .from('master_songs')
          .select('id')
          .ilike('title', `%${track.title}%`)
          .ilike('artist', `%${track.artist}%`)
          .limit(5);

        if (matchedMasters && matchedMasters.length > 0) {
          const masterIds = matchedMasters.map(m => m.id);
          
          // それらの master_songs をカバーするアクティブな歌を取得
          const { data: coverSongs } = await supabase
            .from('songs')
            .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
            .in('master_song_id', masterIds)
            .eq('is_active', true)
            .not('id', 'in', `(${currentExcludes.join(',')})`)
            .limit(limit - recommendedSongs.length);

          if (coverSongs && coverSongs.length > 0) {
            recommendedSongs = [...recommendedSongs, ...coverSongs];
            currentExcludes = Array.from(new Set([...currentExcludes, ...coverSongs.map(s => s.id)]));
          }
        }
      }
      console.log(`[Recommend] Found ${recommendedSongs.length} similar cover songs via Last.fm`);
    }
  }

  // --- B. フォールバック 1: 同じVTuber/チャンネルの他の楽曲 ---
  if (recommendedSongs.length < limit && channelRecordId) {
    const needed = limit - recommendedSongs.length;
    console.log(`[Recommend] Fallback 1: Fetching up to ${needed} songs from the same VTuber channel (${channelRecordId})`);
    
    // チャンネル内の楽曲からランダムな曲IDを取得する (RPCの呼び出し)
    const { data: randomIdsData, error: rpcErr } = await supabase.rpc('get_random_song_ids_by_channel', {
      p_channel_record_id: channelRecordId,
      p_exclude_ids: currentExcludes,
      p_limit: needed
    });

    if (rpcErr) {
      console.error('[Recommend] Error calling get_random_song_ids_by_channel:', rpcErr);
    }

    const randomIds = (randomIdsData as { song_id: number | string }[] | null)?.map(r => Number(r.song_id)) || [];

    if (randomIds.length > 0) {
      const { data: channelSongs } = await supabase
        .from('songs')
        .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
        .in('id', randomIds);

      if (channelSongs && channelSongs.length > 0) {
        // RPCで返ってきたランダムな順番を維持するようにソート
        const sortedSongs = channelSongs.sort((a, b) => {
          return randomIds.indexOf(a.id) - randomIds.indexOf(b.id);
        });
        recommendedSongs = [...recommendedSongs, ...sortedSongs];
        currentExcludes = Array.from(new Set([...currentExcludes, ...sortedSongs.map(s => s.id)]));
      }
    }
  }

  // --- C. フォールバック 2: 全体で再生履歴が多い曲（人気曲） ---
  if (recommendedSongs.length < limit) {
    const needed = limit - recommendedSongs.length;
    console.log(`[Recommend] Fallback 2: Fetching up to ${needed} popular songs`);

    try {
      const { data: rankings } = await supabase.rpc('get_song_rankings', {
        p_days: 30,
        p_limit: needed + 20, // 除外を考慮して少し多めに取得
      });

      if (rankings && rankings.length > 0) {
        const popularSongIds = (rankings as RankingResult[])
          .map(r => r.song_id)
          .filter(id => !currentExcludes.includes(id))
          .slice(0, needed);

        if (popularSongIds.length > 0) {
          const { data: popularSongs } = await supabase
            .from('songs')
            .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
            .in('id', popularSongIds);

          if (popularSongs && popularSongs.length > 0) {
            const sortedPopular = popularSongs.sort((a, b) => {
              return popularSongIds.indexOf(a.id) - popularSongIds.indexOf(b.id);
            });
            recommendedSongs = [...recommendedSongs, ...sortedPopular];
            currentExcludes = Array.from(new Set([...currentExcludes, ...sortedPopular.map(s => s.id)]));
          }
        }
      }
    } catch (err) {
      console.error('[Recommend] Error fetching popular songs fallback:', err);
    }
  }

  // --- D. フォールバック 3: ランダムなアクティブ楽曲 ---
  if (recommendedSongs.length < limit) {
    const needed = limit - recommendedSongs.length;
    console.log(`[Recommend] Fallback 3: Fetching up to ${needed} random active songs`);

    let query = supabase
      .from('songs')
      .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
      .eq('is_active', true);

    if (currentExcludes.length > 0) {
      query = query.not('id', 'in', `(${currentExcludes.join(',')})`);
    }

    // ランダム性を出すために多め（最大100件）に取得してシャッフル
    const { data: randomSongs } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (randomSongs && randomSongs.length > 0) {
      const shuffled = shuffleArray(randomSongs);
      const selected = shuffled.slice(0, needed);
      recommendedSongs = [...recommendedSongs, ...selected];
    }
  }

  return recommendedSongs.map(mapToPlayerSong);
}
