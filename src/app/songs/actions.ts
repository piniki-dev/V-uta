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
  limit = 20,
  allowOthers = true
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

  // 同一原曲のカバー違いが連続するのを防ぐため、選定済みの原曲ID（master_song_id）を追跡する
  const excludeMasterIds = new Set<number>();
  if (baseSong.master_song_id) {
    excludeMasterIds.add(baseSong.master_song_id);
  }

  // --- A. Last.fm API を使った類似曲の取得 ---
  if (masterSong?.title && masterSong?.artist) {
    // 登録曲数が少ない状態でのマッチ率を最大化するため、Last.fmからは多め（100件）に取得する
    const similarTracks = await fetchSimilarTracksFromLastFm(masterSong.title, masterSong.artist, 100);
    
    if (similarTracks.length > 0) {
      // 1. V-uta側の全 master_songs を一発で取得する (N+1回避)
      const { data: allMasters, error: masterErr } = await supabase
        .from('master_songs')
        .select('id, title, artist');

      if (masterErr) {
        console.error('[Recommend] Error fetching all master_songs:', masterErr);
      }

      if (allMasters && allMasters.length > 0) {
        // Last.fmの類似曲リストに部分一致する master_song_id をメモリ上で検索する
        const matchedMasterIds: number[] = [];
        
        for (const track of similarTracks) {
          const trackTitleLower = track.title.toLowerCase();
          const trackArtistLower = track.artist.toLowerCase();

          const matches = allMasters.filter(m => {
            const mTitleLower = (m.title || '').toLowerCase();
            const mArtistLower = (m.artist || '').toLowerCase();
            // 部分一致 (ilike '%track.title%' かつ ilike '%track.artist%' 相当の判定)
            return mTitleLower.includes(trackTitleLower) && mArtistLower.includes(trackArtistLower);
          });

          if (matches.length > 0) {
            matchedMasterIds.push(...matches.map(m => m.id));
          }
        }

        // 重複を除去し、すでに除外対象の原曲IDを除く
        const uniqueMatchedMasterIds = Array.from(new Set(matchedMasterIds))
          .filter(id => !excludeMasterIds.has(id));

        if (uniqueMatchedMasterIds.length > 0) {
          // 2. マッチしたすべての master_songs をカバーするアクティブな歌を1回のクエリで一括取得
          const { data: coverSongs } = await supabase
            .from('songs')
            .select('*, master_song:master_songs(*), video:videos(*, channel:channels(*))')
            .in('master_song_id', uniqueMatchedMasterIds)
            .eq('is_active', true)
            .not('id', 'in', `(${currentExcludes.join(',')})`);

          if (coverSongs && coverSongs.length > 0) {
            // master_song_id ごとにグループ化
            const groupedByMaster: { [masterId: number]: PopulatedSong[] } = {};
            for (const song of coverSongs) {
              const mid = song.master_song_id;
              if (mid) {
                if (!groupedByMaster[mid]) groupedByMaster[mid] = [];
                groupedByMaster[mid].push(song);
              }
            }

            // 各グループ（＝各原曲）から優先順位に基づいて1曲だけを抽出
            const selectedSongs: PopulatedSong[] = [];
            
            // Last.fmの類似度順（similarTracksの並び順）を維持するため、
            // uniqueMatchedMasterIds (これはsimilarTracksのループ順になっている) の順に処理する
            for (const mid of uniqueMatchedMasterIds) {
              const songsInGroup = groupedByMaster[mid];
              if (!songsInGroup || songsInGroup.length === 0) continue;

              // 優先度：検索ベース曲のチャンネルID（channelRecordId）と一致するものを探す
              const sameArtistSong = songsInGroup.find(
                s => s.video?.channel_record_id === channelRecordId
              );

              if (sameArtistSong) {
                selectedSongs.push(sameArtistSong);
              } else if (allowOthers) {
                // 他のVTuberのミックスが許可されている場合のみ、最初の1件を選択
                selectedSongs.push(songsInGroup[0]);
              }
            }

            // limit を超えないように追加し、除外リストを更新
            const finalSelected = selectedSongs.slice(0, limit - recommendedSongs.length);
            if (finalSelected.length > 0) {
              recommendedSongs = [...recommendedSongs, ...finalSelected];
              currentExcludes = Array.from(new Set([...currentExcludes, ...finalSelected.map(s => s.id)]));
              for (const s of finalSelected) {
                if (s.master_song_id) {
                  excludeMasterIds.add(s.master_song_id);
                }
              }
            }
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
          let query = supabase
            .from('songs')
            .select('*, master_song:master_songs(*), video:videos!inner(*, channel:channels(*))')
            .in('id', popularSongIds);

          if (!allowOthers && channelRecordId) {
            query = query.eq('video.channel_record_id', channelRecordId);
          }

          const { data: popularSongs } = await query;

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
      .select('*, master_song:master_songs(*), video:videos!inner(*, channel:channels(*))')
      .eq('is_active', true);

    if (currentExcludes.length > 0) {
      query = query.not('id', 'in', `(${currentExcludes.join(',')})`);
    }

    if (!allowOthers && channelRecordId) {
      query = query.eq('video.channel_record_id', channelRecordId);
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
