'use client';

import React from 'react';
import type { PlayerSong } from '@/types';
import SongRow from './SongRow';
import { Reorder, motion } from 'framer-motion';
import { useLocale } from '@/components/LocaleProvider';

interface SongListProps<T> {
  items: T[];
  mapToPlayerSong: (item: T) => PlayerSong;
  sourceType: string;
  sourceId: string;
  showVideoInfo?: boolean;
  showTimeInfo?: boolean;
  isReorderable?: boolean;
  onReorder?: (newItems: T[]) => void;
  className?: string;
  // 追加: 行ごとのカスタムアクション（削除ボタンなど）
  renderActions?: (item: T, song: PlayerSong) => React.ReactNode;
  onItemClick?: (item: T, song: PlayerSong) => void;
  showPlayedAt?: boolean;
}

export default function SongList<T extends { id: number | string }>({
  items,
  mapToPlayerSong,
  sourceType,
  sourceId,
  showVideoInfo = false,
  showTimeInfo = false,
  isReorderable = false,
  onReorder,
  className = '',
  renderActions,
  onItemClick,
  showPlayedAt = false
}: SongListProps<T>) {
  const { T } = useLocale();

  const playlist = items.map(mapToPlayerSong);

  const renderHeader = () => (
    <div className={`hidden md:grid gap-4 px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/30 text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)] ${
      showVideoInfo 
        ? 'grid-cols-[56px_1fr_1fr_80px_100px]' 
        : 'grid-cols-[56px_1fr_120px_80px_100px]'
    }`}>
      <div className="text-center">{showPlayedAt ? T('history.playedAt') : '#'}</div>
      <div>{T('archive.title')}</div>
      <div>{showVideoInfo ? T('playlist.video') : T('archive.time')}</div>
      <div className="text-right">{T('archive.duration')}</div>
      <div />
    </div>
  );

  if (isReorderable && onReorder) {
    return (
      <div className={`bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-xl ${className}`}>
        {renderHeader()}
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={onReorder}
          className="divide-y divide-[var(--border)]"
        >
          {items.map((item, index) => {
            const song = mapToPlayerSong(item);
            return (
              <Reorder.Item key={item.id} value={item} className="relative">
                <SongRow
                  song={song}
                  index={index}
                  playlist={playlist}
                  sourceType={sourceType}
                  sourceId={sourceId}
                  showVideoInfo={showVideoInfo}
                  showTimeInfo={showTimeInfo}
                  showPlayedAt={showPlayedAt}
                  className="bg-[var(--bg-secondary)]" 
                  renderActions={renderActions?.(item, song)}
                  rowId={item.id}
                />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  return (
    <div className={`bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-xl ${className}`}>
      {renderHeader()}
      <motion.div 
        className="divide-y divide-[var(--border)]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {items.map((item, index) => {
          const song = mapToPlayerSong(item);
          return (
            <SongRow
              key={item.id}
              song={song}
              index={index}
              playlist={playlist}
              sourceType={sourceType}
              sourceId={sourceId}
              showVideoInfo={showVideoInfo}
              showTimeInfo={showTimeInfo}
              showPlayedAt={showPlayedAt}
              renderActions={renderActions?.(item, song)}
              rowId={item.id}
              onClick={onItemClick ? () => onItemClick(item, song) : undefined}
            />
          );
        })}
      </motion.div>
    </div>
  );
}
