import { translations } from '@/lib/translations';
import Hero from '@/components/Hero';
import SearchSongs from './SearchSongs';
import { ArchivesGrid, ChannelsGrid } from '@/components/search/SearchGrids';
import SearchSectionHeader from '@/components/search/SearchSectionHeader';
import { X } from 'lucide-react';
import type { Video, Channel, PlayerSong, SearchSongItem } from '@/types';

interface SearchViewProps {
  query: string;
  songs: SearchSongItem[]; 
  videos: Video[];
  channels: Channel[];
  locale: 'ja' | 'en';
}

export default function SearchView({ query, songs, videos, channels, locale }: SearchViewProps) {
  const t = translations[locale];

  return (
    <div className="min-h-screen">
      <Hero
        title={t.search.title}
        description={
          !query ? (
            t.search.inputKeyword
          ) : (
            <p className="text-xl font-medium">
              {t.search.resultsFor.replace('{query}', query)}
            </p>
          )
        }
        badge={
          query ? (
            <span>
              {songs.length + videos.length + channels.length > 0 
                ? t.search.found
                : t.search.notFound}
            </span>
          ) : undefined
        }
        centered
      />

      {query && (
        <div className="container mx-auto py-20 pb-48">
          <div className="space-y-32">
            {/* 楽曲セクション */}
            <section>
              <SearchSectionHeader iconColorClass="bg-gradient-to-b from-[var(--accent)] to-[#8e4eff]">
                {t.search.songs}
                <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                  {songs.length}
                </span>
              </SearchSectionHeader>
              
              {songs.length > 0 ? (
                <SearchSongs songs={songs} />
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {t.search.notFound}
                </div>
              )}
            </section>

            {/* アーカイブセクション */}
            <section>
              <SearchSectionHeader iconColorClass="bg-gradient-to-b from-[#ff8e4e] to-[#ff4e8e]" glowClass="shadow-[0_0_20px_rgba(255,142,78,0.3)]">
                {t.search.archives}
                <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[#ff8e4e] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                  {videos.length}
                </span>
              </SearchSectionHeader>

              {videos.length > 0 ? (
                <ArchivesGrid videos={videos} />
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {t.search.notFound}
                </div>
              )}
            </section>

            {/* チャンネルセクション */}
            <section>
              <SearchSectionHeader iconColorClass="bg-gradient-to-b from-[#4e8eff] to-[#8e4eff]" glowClass="shadow-[0_0_20px_rgba(78,142,255,0.3)]">
                {t.search.channels}
                <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[#4e8eff] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                  {channels.length}
                </span>
              </SearchSectionHeader>

              {channels.length > 0 ? (
                <ChannelsGrid channels={channels} />
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {t.search.notFound}
                </div>
              )}
            </section>

            {songs.length === 0 && videos.length === 0 && channels.length === 0 && (
              <div className="text-center py-20 animate-in fade-in duration-1000">
                <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--text-tertiary)] border border-[var(--border)]">
                  <X size={32} />
                </div>
                <p className="text-[var(--text-secondary)] text-lg font-medium">
                  {t.search.tryAnother}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
