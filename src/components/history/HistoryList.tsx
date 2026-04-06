'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { useLocale } from '@/components/LocaleProvider';
import { getPlayHistory } from '@/app/history/actions';
import SongList from '@/components/song/SongList';
import { motion } from 'framer-motion';
import { Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

import type { HistoryItem } from '@/app/history/actions';

interface HistoryListProps {
  initialHistory: HistoryItem[];
}

export default function HistoryList({ initialHistory }: HistoryListProps) {
  const { playWithSource } = usePlayer();
  const { locale, T, isMounted } = useLocale();
  const [history, setHistory] = useState(initialHistory);
  const [offset, setOffset] = useState(initialHistory.length);
  const [hasMore, setHasMore] = useState(initialHistory.length === 50);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const toPlayerSong = useCallback((item: HistoryItem): PlayerSong => {
    const { song } = item;
    return {
      id: song.id,
      title: song.master_song?.title || '',
      artist: song.master_song?.artist || null,
      title_en: song.master_song?.title_en || null,
      artist_en: song.master_song?.artist_en || null,
      artworkUrl: song.master_song?.artwork_url || null,
      videoId: song.video.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: song.video.channel?.name || null,
      channelThumbnailUrl: song.video.channel?.image || null,
      thumbnailUrl: song.video.thumbnail_url || null,
      videoTitle: song.video.title,
      playedAt: item.played_at
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    const limit = 50;
    const result = await getPlayHistory(limit, offset);
    
    if (result.success && result.data) {
      const newItems = result.data;
      if (newItems.length < limit) {
        setHasMore(false);
      }
      setHistory(prev => [...prev, ...newItems]);
      setOffset(prev => prev + newItems.length);
    } else {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [isLoading, hasMore, offset]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoading]);

  const handlePlayHistory = (item: HistoryItem) => {
    const song = toPlayerSong(item);
    playWithSource(song, [song], 'history', String(item.id));
  };

  // 今日の日付と昨日の日付をマウント後に計算（ハイドレーションエラー防止）
  const dateLabels = useMemo(() => {
    if (!isMounted) return { today: '', yesterday: '' };
    const now = new Date();
    const t = now.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const y = new Date(now.getTime() - 86400000).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    return { today: t, yesterday: y };
  }, [isMounted, locale]);

  // 日付ごとにグループ化 (ハイドレーションのために安定したキーを使用)
  const groupedHistory = useMemo(() => {
    return history.reduce((groups: Record<string, HistoryItem[]>, item: HistoryItem) => {
      // サーバーとクライアントで一致するように、toLocaleDateString ではなく安定した形式でグループ化キーを作成
      const d = new Date(item.played_at);
      const dateKey = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
      return groups;
    }, {});
  }, [history]);

  const formatDateLabel = useCallback((dateKey: string) => {
    const d = new Date(dateKey);
    const dateStr = d.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });

    if (!isMounted) return dateStr;
    if (dateStr === dateLabels.today) return T('history.today');
    if (dateStr === dateLabels.yesterday) return T('history.yesterday');
    return dateStr;
  }, [dateLabels, locale, T, isMounted]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  } as const;

  return (
    <div className="container mx-auto px-6 py-12 pb-48">
      {history.length === 0 ? (
        <motion.div 
          className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-20 text-center flex flex-col items-center gap-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
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
        </motion.div>
      ) : (
        <motion.div 
          className="space-y-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {Object.entries(groupedHistory).map(([dateKey, items]: [string, HistoryItem[]]) => (
            <motion.section key={dateKey} variants={itemVariants}>
              <div className="flex items-center gap-3 mb-6">
                <Calendar size={18} className="text-[var(--accent)]" />
                <h2 className="text-lg font-black text-[var(--text-primary)]">{formatDateLabel(dateKey)}</h2>
                <div className="h-px bg-[var(--border)] flex-1 ml-2" />
              </div>

              <SongList 
                items={items}
                mapToPlayerSong={toPlayerSong}
                sourceType="history"
                sourceId="history"
                showVideoInfo={true}
                showPlayedAt={true}
                onItemClick={(item) => handlePlayHistory(item)}
              />
            </motion.section>
          ))}

          {/* 無限スクロール用ローダー */}
          <div ref={loaderRef} className="py-12 flex justify-center">
            {isLoading && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-[var(--text-secondary)]">{T('common.loading')}</p>
              </div>
            )}
            {!hasMore && history.length > 0 && (
              <p className="text-[var(--text-tertiary)] font-medium">{T('history.noMore') || 'これ以上の履歴はありません'}</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
