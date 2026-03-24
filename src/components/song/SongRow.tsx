'use client';

import React from 'react';
import { Music, Play, ExternalLink, Clock } from 'lucide-react';
import Link from 'next/link';
import type { PlayerSong } from '@/types';
import { formatTime } from '@/lib/utils';
import { usePlayer } from '@/components/player/PlayerContext';
import { useLocale } from '@/components/LocaleProvider';
import SongMenu from './SongMenu';
import FavoriteButton from './FavoriteButton';

export interface SongRowProps {
  song: PlayerSong;
  index: number;
  playlist: PlayerSong[];
  sourceType: string;
  sourceId: string;
  showVideoInfo?: boolean;
  showTimeInfo?: boolean;
  showIndex?: boolean;
  active?: boolean;
  className?: string;
  renderActions?: React.ReactNode;
  rowId?: string | number;
  // Events
  onClick?: () => void;
}

export default function SongRow({
  song,
  index,
  playlist,
  sourceType,
  sourceId,
  showVideoInfo = false,
  showTimeInfo = false,
  showIndex = true,
  active = false,
  className = '',
  renderActions,
  rowId,
  onClick
}: SongRowProps) {
  const { playWithSource, state } = usePlayer();
  const { t } = useLocale();

  const isCurrentSong = (() => {
    if (state.currentSong?.id !== song.id) return false;

    // 1. 履歴ページの場合: 行単位の一致を確認（同じ曲が複数ある場合に対応）
    if (sourceType === 'history' && rowId) {
      if (state.sourceType === 'history' && state.sourceId === String(rowId)) return true;
      if (state.currentHistoryId === Number(rowId)) return true;
      return false;
    }

    // 2. ソースが一致する場合: インデックスで厳密に判定（すべてのリスト形式で共通）
    // これにより、同じ曲がリスト内に複数ある場合でも正しい行だけにインジケーターが出る
    if (state.sourceType === sourceType && state.sourceId === sourceId) {
      return state.currentIndex === index;
    }

    // 3. ソースが一致しない場合:
    // プレイリスト、アーカイブ（動画詳細）、チャンネル等の構造化されたリストでは、
    // 他の場所から再生している場合は表示しない（重複表示の防止）
    const strictSources = ['playlist', 'video', 'channel', 'vtuber'];
    if (sourceType && strictSources.includes(sourceType)) {
      return false;
    }

    // 4. それ以外（検索結果、ホーム画面等）は、IDが合えば表示する
    return true;
  })();

  const isPlaying = isCurrentSong && state.isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    // ボタンやリンクをクリックした場合は再生しない
    if ((e.target as HTMLElement).closest('button, a')) return;
    
    if (onClick) {
      onClick();
    } else {
      playWithSource(song, playlist, sourceType, sourceId);
    }
  };

  return (
    <div
      onClick={handlePlay}
      className={`group grid gap-4 items-center px-6 py-4 hover:bg-[var(--bg-hover)] transition-all cursor-pointer relative ${
        isCurrentSong ? 'bg-[var(--bg-hover)]' : ''
      } ${
        showVideoInfo 
          ? 'grid-cols-[40px_1fr_40px] md:grid-cols-[40px_1fr_1fr_80px_100px]' 
          : 'grid-cols-[40px_1fr_40px] md:grid-cols-[40px_1fr_120px_80px_100px]'
      } ${className}`}
    >
      {/* 1. Index / Playing Icon */}
      {showIndex && (
        <div className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] font-bold text-sm tabular-nums text-center transition-colors">
          {isPlaying ? (
            <div className="flex items-center justify-center gap-0.5 h-4">
              <span className="w-0.5 h-full bg-[var(--accent)] animate-[music-bar_0.6s_ease-in-out_infinite]" />
              <span className="w-0.5 h-full bg-[var(--accent)] animate-[music-bar_0.8s_ease-in-out_infinite_0.1s]" />
              <span className="w-0.5 h-full bg-[var(--accent)] animate-[music-bar_0.7s_ease-in-out_infinite_0.2s]" />
            </div>
          ) : (
            String(index + 1).padStart(2, '0')
          )}
        </div>
      )}

      {/* 2. Song Info (Artwork, Title, Artist) */}
      <div className="min-w-0 flex items-center gap-4">
        <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm border border-[var(--border)]">
          {song.artworkUrl ? (
            <img src={song.artworkUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={16} className="text-[var(--text-tertiary)]" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play size={20} fill="white" className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <div className={`font-bold truncate group-hover:text-[var(--accent)] transition-colors ${
            isCurrentSong ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
          }`}>
            {t(song.title, song.title_en || song.title)}
          </div>
          <div className="text-sm text-[var(--text-secondary)] truncate">
            {t(song.artist || '-', song.artist_en || song.artist || '-')}
          </div>
        </div>
      </div>

      {/* 3. Conditional: Video Info OR Time Info */}
      {showVideoInfo ? (
        <div className="hidden md:block min-w-0">
          <Link 
            href={`/videos/${song.videoId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors flex flex-col gap-0.5 w-fit max-w-full group/video"
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="truncate">{song.videoTitle}</span>
              <ExternalLink size={12} className="shrink-0 opacity-40 group-hover/video:opacity-100 transition-opacity" />
            </div>
            {song.channelName && (
              <span className="text-[11px] text-[var(--text-tertiary)] truncate opacity-80">{song.channelName}</span>
            )}
          </Link>
        </div>
      ) : showTimeInfo ? (
        <div className="hidden md:flex items-center gap-2 text-sm text-[var(--text-tertiary)] font-medium tabular-nums">
          <Clock size={14} className="opacity-40" />
          <span>{formatTime(song.startSec)} - {formatTime(song.endSec)}</span>
        </div>
      ) : (
        <div className="hidden md:block" />
      )}

      {/* 4. Duration */}
      <div className="text-right text-[var(--text-secondary)] font-bold text-sm tabular-nums">
        {formatTime(song.endSec - song.startSec)}
      </div>

      {/* 5. Actions (Favorite & Menu) */}
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <FavoriteButton songId={song.id} />
        {renderActions}
        <SongMenu song={song} />
      </div>

      <style jsx>{`
        @keyframes music-bar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `}</style>
    </div>
  );
}
