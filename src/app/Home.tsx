import { createClient } from '@/utils/supabase/server';
import type { Video } from '@/types';
import HomeHero from '@/components/home/HomeHero';
import HomeVideoGrid from '@/components/home/HomeVideoGrid';
import HomeRankingSection from '@/components/home/HomeRankingSection';
import HomeChannelSection from '@/components/home/HomeChannelSection';
import { getSongRankings } from '@/app/history/actions';

export default async function Home() {
  const supabase = await createClient();

  // 1. & 2. & 3. データの並列取得 (Parallel Data Fetching)
  // 全てのクエリを並列化することで、モバイル等の環境での TTFB を改善します
  const [userRes, videoRes, rankingRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('videos')
      .select('*, channel:channels(*), songs!inner(id)')
      .order('created_at', { ascending: false })
      .limit(24),
    getSongRankings({ days: 7, limit: 50, supabase })
  ]);

  const { data: { user } } = userRes;
  const { data: videoData } = videoRes;

  const videos = ((videoData as unknown as Video[]) || [])
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
    .slice(0, 12);

  const allRankingSongs = (rankingRes.success && rankingRes.data) ? rankingRes.data : [];
  const initialRanking = allRankingSongs.slice(0, 10);

  // 3. 人気チャンネル (ランキングデータから抽出)
  // 上位50曲に含まれるチャンネルから、ユニークなものを抽出
  const popularChannels = Array.from(new Map(allRankingSongs.map(s => [s.channelId, { 
    id: s.channelId,
    handle: s.channelHandle,
    name: s.channelName, 
    image: s.channelThumbnailUrl 
  }])).values()).slice(0, 12);

  return (
    <div className="min-h-screen">
      {/* 未ログイン時のみヒーローセクションを表示 */}
      {!user && <HomeHero />}

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
