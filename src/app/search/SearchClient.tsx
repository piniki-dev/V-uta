'use client';

import React from 'react';
import { useLocale } from '@/components/LocaleProvider';
import SearchSongs from './SearchSongs';
import Link from 'next/link';

interface SearchClientProps {
  query: string;
  songs: any[];
  channels: any[];
}

export default function SearchClient({ query, songs, channels }: SearchClientProps) {
  const { T } = useLocale();

  return (
    <div className="container min-h-screen py-24 pb-40">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-black mb-4 tracking-tight text-[var(--text-primary)]">
            {T('search.title')}
          </h1>
          {!query ? (
            <p className="text-[var(--text-secondary)] text-lg">
              {T('search.inputKeyword')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[var(--text-secondary)] text-lg">
                {T('search.resultsFor', { query })}
              </p>
              <p className="text-sm font-medium text-[var(--accent)]">
                {songs.length + channels.length > 0 
                  ? T('search.found')
                  : T('search.notFound')}
              </p>
            </div>
          )}
        </header>

        {query && (
          <div className="space-y-16">
            {/* 楽曲セクション */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-[var(--text-primary)]">
                <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                {T('search.songs')}
                <span className="text-sm font-normal text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                  {songs.length}
                </span>
              </h2>
              {songs.length > 0 ? (
                <SearchSongs songs={songs} />
              ) : (
                <div className="py-12 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)]">
                  {T('search.notFound')}
                </div>
              )}
            </section>

            {/* チャンネルセクション */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-[var(--text-primary)]">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                {T('search.channels')}
                <span className="text-sm font-normal text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                  {channels.length}
                </span>
              </h2>
              {channels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {channels.map(channel => (
                    <Link 
                      key={channel.id}
                      href={`/channels/${channel.handle || channel.id}`}
                      className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl hover:bg-[var(--bg-hover)] transition-all group"
                    >
                      <img 
                        src={channel.image || '/placeholder-avatar.jpg'} 
                        alt="" 
                        className="w-14 h-14 rounded-full object-cover shadow-lg border border-[var(--border)]"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {channel.name}
                        </div>
                        {channel.handle && (
                          <div className="text-sm text-[var(--text-tertiary)] truncate">
                            @{channel.handle.replace('@', '')}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)]">
                  {T('search.notFound')}
                </div>
              )}
            </section>

            {songs.length === 0 && channels.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[var(--text-secondary)] mb-6">
                  {T('search.tryAnother')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

