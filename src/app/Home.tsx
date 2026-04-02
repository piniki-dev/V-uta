import { createClient } from '@/utils/supabase/server';
import type { Video } from '@/types';
import HomeHero from '@/components/home/HomeHero';
import HomeVideoGrid from '@/components/home/HomeVideoGrid';

export default async function Home() {
  const supabase = await createClient();
  
  // サーバーサイドでデータを取得
  const { data } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .order('created_at', { ascending: false })
    .limit(12);

  const videos = data as Video[] || [];

  return (
    <div className="min-h-screen">
      {/* プレミアムヒーローセクション (Client Component) */}
      <HomeHero />

      {/* 最近追加されたアーカイブ (Client Component with Server Data) */}
      <HomeVideoGrid initialVideos={videos} />
    </div>
  );
}
