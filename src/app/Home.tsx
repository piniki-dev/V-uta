import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Video } from '@/types';
import HomeVideoGrid from '@/components/home/HomeVideoGrid';
import HomeRankingSection from '@/components/home/HomeRankingSection';
import HomeChannelSection from '@/components/home/HomeChannelSection';
import { getSongRankings } from '@/app/history/actions';

// 1. 最近追加された動画リストをキャッシュ (過去7日間分を1時間ごと自動更新 + 手動パージ)
const getHomeVideosCached = unstable_cache(
  async () => {
    console.log('[unstable_cache] Fetching home videos from DB...');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    // 7日前の日時を計算 (ISO-8601 形式)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { data: videoData, error } = await supabase
      .from('videos')
      .select('*, channel:channels(*), songs!inner(id)')
      .gte('created_at', sevenDaysAgoISO)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('getHomeVideosCached error:', error);
      return [];
    }

    const videos = ((videoData as unknown as Video[]) || [])
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .slice(0, 12);

    return videos;
  },
  ['home-videos-cached'],
  {
    revalidate: 3600, // 過去7日間の基準時刻が経過するのに合わせて自動更新
    tags: ['home-videos']
  }
);

// 2. 再生ランキングとそれに基づく人気チャンネルをキャッシュ (10分自動更新)
const getHomeRankingCached = unstable_cache(
  async () => {
    console.log('[unstable_cache] Fetching home ranking from DB...');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const rankingRes = await getSongRankings({ days: 7, limit: 50, supabase });
    const allRankingSongs = (rankingRes.success && rankingRes.data) ? rankingRes.data : [];
    const initialRanking = allRankingSongs.slice(0, 10);

    const popularChannels = Array.from(new Map(allRankingSongs.map(s => [s.channelId, { 
      id: s.channelId,
      handle: s.channelHandle,
      name: s.channelName, 
      image: s.channelThumbnailUrl 
    }])).values()).slice(0, 12);

    return {
      initialRanking,
      popularChannels
    };
  },
  ['home-ranking-cached'],
  {
    revalidate: 600, // 10分
    tags: ['home-ranking']
  }
);

export default async function Home() {
  // 並列でキャッシュデータをロード
  const [videos, rankingData] = await Promise.all([
    getHomeVideosCached(),
    getHomeRankingCached()
  ]);

  const { initialRanking, popularChannels } = rankingData;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 space-y-24 py-12 pb-48">
        
        {/* 楽曲ランキング (リスト形式) */}
        <HomeRankingSection initialSongs={initialRanking.slice(0, 10)} />

        {/* 人気のチャンネル */}
        {popularChannels.length > 0 && (
          <HomeChannelSection channels={popularChannels.slice(0, 10)} />
        )}

        {/* 最近追加されたアーカイブ */}
        <HomeVideoGrid initialVideos={videos} />
      </div>
    </div>
  );
}
