import SearchView from './SearchView';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';
import type { Video, Channel, SearchSongItem } from '@/types';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams;
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];
  
  const title = q ? `${decodeURIComponent(q)} - ${t.header.searchPlaceholder}` : t.header.searchPlaceholder;

  return {
    title: `${title} | ${t.common.siteTitle}`,
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) {
  const { q: query } = await searchParams;
  const supabase = await createClient();
  let songs: SearchSongItem[] = []; 
  let videos: Video[] = [];
  let channels: Channel[] = [];

  if (query) {
    const decodedQuery = decodeURIComponent(query);
    
    // 楽曲検索 (master_songs と videos をそれぞれ検索してマージ)
    // Supabaseの .or() を複数つなげると AND 扱いになるため、個別に取得する
    const [songsByMaster, videosData, channelsData] = await Promise.all([
      // 1. 楽曲検索 (master_songs のみ対象)
      supabase
        .from('songs')
        .select(`
          id, start_sec, end_sec,
          master_songs!inner (title, artist, title_en, artist_en, artwork_url),
          videos (video_id, title, thumbnail_url, channels (name, image))
        `)
        .or(`title.ilike.%${decodedQuery}%,artist.ilike.%${decodedQuery}%,title_en.ilike.%${decodedQuery}%,artist_en.ilike.%${decodedQuery}%`, { foreignTable: 'master_songs' })
        .limit(50),
      
      // 2. アーカイブ検索
      supabase
        .from('videos')
        .select(`
          *,
          channels (name)
        `)
        .ilike('title', `%${decodedQuery}%`)
        .limit(20),

      // 3. チャンネル検索
      supabase
        .from('channels')
        .select('*')
        .or(`name.ilike.%${decodedQuery}%,handle.ilike.%${decodedQuery}%`)
        .limit(10)
    ]);

    songs = (songsByMaster.data || []) as unknown as SearchSongItem[];
    videos = (videosData.data || []) as Video[];
    channels = (channelsData.data || []) as Channel[];
  }

  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';

  return (
    <SearchView 
      query={query ? decodeURIComponent(query) : ''} 
      songs={songs} 
      videos={videos}
      channels={channels}
      locale={locale}
    />
  );
}
