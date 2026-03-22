import SearchClient from './SearchClient';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

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

  let songs: any[] = [];
  let channels: any[] = [];

  if (query) {
    const decodedQuery = decodeURIComponent(query);
    
    // 楽曲検索 (RPCを使用)
    const { data: songsData } = await supabase.rpc('search_songs', {
      search_query: decodedQuery
    });
    
    // チャンネル検索
    const { data: channelsData } = await supabase
      .from('channels')
      .select('*')
      .or(`name.ilike.%${decodedQuery}%,handle.ilike.%${decodedQuery}%`)
      .limit(10);

    songs = songsData || [];
    channels = channelsData || [];
  }

  return <SearchClient query={query ? decodeURIComponent(query) : ''} songs={songs} channels={channels} />;
}
