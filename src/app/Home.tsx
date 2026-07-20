import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import HomeVideoGrid from '@/components/home/HomeVideoGrid';
import HomeRankingSection from '@/components/home/HomeRankingSection';
import HomeChannelSection from '@/components/home/HomeChannelSection';
import { getSongRankings } from '@/app/history/actions';
import { getHomeVideosCached } from '@/app/videos/actions';


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
        <HomeVideoGrid initialVideos={videos} limit={12} />
      </div>
    </div>
  );
}
