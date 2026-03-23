'use client';

import { useState } from 'react';
import { clearPlayHistory } from './actions';
import type { PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Play, Trash2, History, ExternalLink, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import SongMenu from '@/components/song/SongMenu';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  initialHistory: any[];
}

export default function HistoryClient({ initialHistory }: Props) {
  const { playWithSource, state } = usePlayer();
  const { t, locale, T } = useLocale();
  const [history, setHistory] = useState(initialHistory);
  const [isClearing, setIsClearing] = useState(false);

  const toPlayerSong = (item: any): PlayerSong => {
    const song = item.songs;
    return {
      id: song.id,
      title: song.master_songs.title,
      artist: song.master_songs.artist,
      title_en: song.master_songs.title_en || null,
      artist_en: song.master_songs.artist_en || null,
      artworkUrl: song.master_songs.artwork_url,
      videoId: song.videos.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: song.videos.channels?.name || null,
      thumbnailUrl: song.videos.thumbnail_url || null,
      videoTitle: song.videos.title
    };
  };

  const handlePlayHistory = (item: any) => {
    const song = toPlayerSong(item);
    playWithSource(song, [song], 'history', item.id);
  };

  const handleClearAll = async () => {
    if (!confirm(T('history.clearConfirm'))) return;
    
    setIsClearing(true);
    const result = await clearPlayHistory();
    if (result.success) {
      setHistory([]);
    } else {
      alert(result.error);
    }
    setIsClearing(false);
  };

  // 日付ごとにグループ化
  const groupedHistory = history.reduce((groups: any, item: any) => {
    const date = new Date(item.played_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {});

  const formatDateLabel = (dateStr: string) => {
    const today = new Date().toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    
    if (dateStr === today) return T('history.today');
    if (dateStr === yesterday) return T('history.yesterday');
    return dateStr;
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-32 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[#ff4e8e] to-[#8e4eff] rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-[#ff4e8e]/20">
            <History size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">{T('history.pageTitle')}</h1>
            <p className="text-[#666] font-medium">{T('history.pageDescription')}</p>
          </div>
        </div>
        
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-elevated)] hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 font-bold rounded-2xl border border-[var(--border)] hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Trash2 size={18} />
            {T('history.clearAll')}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-20 text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
            <Clock size={40} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)] mb-2">{T('history.empty')}</p>
            <p className="text-[var(--text-secondary)]">{T('history.emptySub')}</p>
          </div>
          <Link href="/" className="mt-4 px-8 py-3 bg-[var(--accent)] text-white font-bold rounded-full hover:bg-[var(--accent-hover)] transition-all active:scale-95">
            {T('history.explore')}
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedHistory).map(([date, items]: [string, any]) => (
            <section key={date}>
              <div className="flex items-center gap-3 mb-6">
                <Calendar size={18} className="text-[var(--accent)]" />
                <h2 className="text-lg font-black text-[var(--text-primary)]">{formatDateLabel(date)}</h2>
                <div className="h-px bg-[var(--border)] flex-1 ml-2" />
              </div>

              <SongList 
                items={items}
                mapToPlayerSong={toPlayerSong}
                sourceType="history"
                sourceId="history"
                showVideoInfo={true}
                onItemClick={(item) => handlePlayHistory(item)}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
