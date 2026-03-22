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

interface Props {
  initialHistory: any[];
}

export default function HistoryClient({ initialHistory }: Props) {
  const { playWithSource, state } = usePlayer();
  const [history, setHistory] = useState(initialHistory);
  const [isClearing, setIsClearing] = useState(false);

  const toPlayerSong = (item: any): PlayerSong => {
    const song = item.songs;
    return {
      id: song.id,
      title: song.master_songs.title,
      artist: song.master_songs.artist,
      artworkUrl: song.master_songs.artwork_url,
      videoId: song.videos.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: song.videos.channels?.name || null,
      thumbnailUrl: null,
      videoTitle: song.videos.title
    };
  };

  const handlePlayHistory = (item: any) => {
    const song = toPlayerSong(item);
    playWithSource(song, [song], 'history', item.id);
  };

  const handleClearAll = async () => {
    if (!confirm('再生履歴をすべて削除しますか？')) return;
    
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
    const date = new Date(item.played_at).toLocaleDateString('ja-JP', {
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
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    
    if (dateStr === today) return '今日';
    if (dateStr === yesterday) return '昨日';
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
            <h1 className="text-4xl font-black mb-2 tracking-tight">再生履歴</h1>
            <p className="text-[#666] font-medium">あなたが最近聴いた楽曲のリストです</p>
          </div>
        </div>
        
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-elevated)] hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-500 font-bold rounded-2xl border border-[var(--border)] hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Trash2 size={18} />
            履歴を消去
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-20 text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-[var(--text-tertiary)]">
            <Clock size={40} />
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--text-primary)] mb-2">履歴がありません</p>
            <p className="text-[var(--text-secondary)]">たくさんの曲を聴いて、好みの履歴を作りましょう</p>
          </div>
          <Link href="/" className="mt-4 px-8 py-3 bg-[var(--accent)] text-white font-bold rounded-full hover:bg-[var(--accent-hover)] transition-all active:scale-95">
            曲を聴きにいく
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

              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden divide-y divide-[var(--border)] shadow-xl">
                {items.map((item: any) => {
                  const song = item.songs;
                  const playedTime = new Date(item.played_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handlePlayHistory(item)}
                      className="group grid grid-cols-[60px_1fr_1fr_40px] md:grid-cols-[80px_1fr_1fr_100px_40px] px-6 py-4 gap-4 items-center hover:bg-[var(--bg-hover)] transition-all cursor-pointer relative"
                    >
                      <div className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] font-bold text-sm tabular-nums text-center transition-colors">
                        {playedTime}
                      </div>

                      <div className="min-w-0 flex items-center gap-4">
                        <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                          {song.master_songs.artwork_url ? (
                            <img src={song.master_songs.artwork_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Play size={16} fill="var(--text-tertiary)" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play size={20} fill="white" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{song.master_songs.title}</div>
                          <div className="text-sm text-[var(--text-secondary)] truncate">{song.master_songs.artist}</div>
                        </div>
                      </div>

                      <div className="hidden md:block min-w-0">
                        <Link 
                          href={`/videos/${song.videos.video_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors flex flex-col gap-0.5 w-fit max-w-full group/video"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{song.videos.title}</span>
                            <ExternalLink size={12} className="shrink-0 opacity-40 group-hover/video:opacity-100 transition-opacity" />
                          </div>
                          {song.videos.channels && (
                            <span className="text-[11px] text-[var(--text-tertiary)] truncate opacity-80">{song.videos.channels.name}</span>
                          )}
                        </Link>
                      </div>

                      <div className="text-right text-[var(--text-secondary)] font-bold text-sm tabular-nums">
                        {formatTime(song.end_sec - song.start_sec)}
                      </div>

                      <div className="flex justify-end">
                        <SongMenu song={toPlayerSong(item)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
