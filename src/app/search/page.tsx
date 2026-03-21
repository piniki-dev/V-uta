import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Music, Tv } from 'lucide-react';
import SearchSongs from './SearchSongs';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: query } = await searchParams;
  const decodedQuery = query ? decodeURIComponent(query) : '';

  if (!decodedQuery) {
    return (
      <div className="container page-container">
        <h1 className="page-title">検索</h1>
        <p className="text-secondary">検索キーワードを入力してください。</p>
      </div>
    );
  }

  const supabase = await createClient();

  // 1. 楽曲の検索 (master_songs を通じて)
  const { data: songsData } = await supabase
    .from('songs')
    .select(`
      *,
      master_songs!inner (*),
      videos!inner (
        *,
        channels!inner (*)
      )
    `)
    .or(`title.ilike.%${decodedQuery}%,artist.ilike.%${decodedQuery}%`, { foreignTable: 'master_songs' })
    .limit(20);

  // 2. チャンネルの検索
  const { data: channelsData } = await supabase
    .from('channels')
    .select(`
      *
    `)
    .ilike('name', `%${decodedQuery}%`)
    .limit(10);

  const hasResults = (songsData?.length || 0) + (channelsData?.length || 0) > 0;

  return (
    <div className="container page-container max-w-5xl">
      <header className="mb-12">
        <h1 className="text-4xl font-black mb-4 tracking-tight">「{decodedQuery}」の検索結果</h1>
        <p className="text-[#666] font-medium">
          {hasResults ? '一致する項目が見つかりました。' : '一致する項目が見つかりませんでした。'}
        </p>
      </header>

      {!hasResults && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center text-[#333]">
            <Music size={40} />
          </div>
          <p className="text-[#666]">別のキーワードで試してみてください。</p>
        </div>
      )}

      {/* 楽曲セクション */}
      {songsData && songsData.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Music size={20} className="text-[#ff4e8e]" />
            <h2 className="text-2xl font-black text-white/90">楽曲</h2>
            <div className="h-px bg-white/5 flex-1 ml-2" />
          </div>
          
          <SearchSongs songs={songsData} />
        </section>
      )}

      {/* チャンネルセクション */}
      {channelsData && channelsData.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Tv size={20} className="text-[#ff4e8e]" />
            <h2 className="text-2xl font-black text-white/90">チャンネル</h2>
            <div className="h-px bg-white/5 flex-1 ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channelsData.map((channel) => (
              <Link
                key={channel.id}
                href={`/channels/${encodeURIComponent(channel.handle || channel.id)}`}
                className="group bg-white/5 border border-white/10 p-4 flex items-center gap-4 hover:bg-white/10 transition-all rounded-3xl"
              >
                {channel.image ? (
                  <img src={channel.image} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">📺</div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-[#e0e0e0] group-hover:text-[#ff4e8e] transition-colors truncate">{channel.name}</div>
                  {channel.handle && (
                    <div className="text-xs text-[#666] truncate">@{channel.handle.replace(/^@/, '')}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
