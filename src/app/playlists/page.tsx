'use client';

import { useState, useEffect } from 'react';
import { getPlaylists } from './actions';
import type { Playlist } from '@/types';
import Link from 'next/link';
import { Loader2, Lock, Globe, ListMusic, Plus } from 'lucide-react';

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setIsLoading(true);
    const result = await getPlaylists();
    if (result.success && result.data) {
      setPlaylists(result.data);
    } else if (!result.success) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin text-[#ff4e8e]" size={32} />
        <p className="text-[#666]">ロード中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ListMusic className="text-[#ff4e8e]" size={32} />
            プレイリスト
          </h1>
          <p className="text-[#666] mt-2">お気に入りの楽曲をまとめて管理</p>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl">
          {error}
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--text-tertiary)]">
            <ListMusic size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">プレイリストがまだありません</h2>
          <p className="text-[var(--text-secondary)] mb-8">アーカイブ詳細ページから楽曲を追加して、最初のプレイリストを作成しましょう</p>
          <Link href="/" className="btn btn--primary">
            配信アーカイブを探す
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlists/${playlist.id}`}
              className="group bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-6 transition-all hover:bg-[var(--bg-hover)] hover:border-[var(--accent)] hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[var(--accent-glow)] rounded-2xl flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                  <ListMusic size={24} />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold px-3 py-1 bg-[var(--bg-tertiary)] rounded-full text-[var(--text-tertiary)]">
                  {playlist.is_public ? (
                    <>
                      <Globe size={12} />
                      公開
                    </>
                  ) : (
                    <>
                      <Lock size={12} />
                      非公開
                    </>
                  )}
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-[var(--accent)] transition-colors line-clamp-1 text-[var(--text-primary)]">
                {playlist.name}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm line-clamp-2 h-10 mb-4">
                {playlist.description || '説明なし'}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)]">
                <span>{new Date(playlist.created_at).toLocaleDateString()}</span>
                <span className="group-hover:text-[var(--accent)] transition-colors">詳細を見る →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
