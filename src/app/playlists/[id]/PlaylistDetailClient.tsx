'use client';

import { useState, useTransition, useEffect } from 'react';
import { removeSongFromPlaylist, updatePlaylist, updatePlaylistOrder } from '../actions';
import type { Playlist, PlaylistItem, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Play, Trash2, ListMusic, Globe, Lock, Loader2, ExternalLink, Pencil, Save, X, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';
import { useFavorites } from '@/components/FavoritesProvider';

interface Props {
  playlist: Playlist & { items: any[] };
}

export default function PlaylistDetailClient({ playlist }: Props) {
  const { playWithSource, state } = usePlayer();
  const { T } = useLocale();
  const { isFavorited, favoriteIds } = useFavorites();
  const [items, setItems] = useState(playlist.items);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editDescription, setEditDescription] = useState(playlist.description || '');
  const [editIsPublic, setEditIsPublic] = useState(playlist.is_public);
  const [isPending, startTransition] = useTransition();

  // お気に入りプレイリストの場合、同期された favoriteIds に基づいて表示をフィルタリング
  const displayItems = playlist.is_favorites
    ? items.filter(item => item.songs && favoriteIds.has(item.songs.id))
    : items;

  // 外部からの更新（追加など）があった場合に同期
  useEffect(() => {
    setItems(playlist.items);
  }, [playlist.items]);

  const toPlayerSong = (item: any): PlayerSong => {
    const song = item.songs;
    return {
      id: song?.id || 0,
      title: song?.master_songs?.title || 'Unknown',
      artist: song?.master_songs?.artist || null,
      title_en: song?.master_songs?.title_en || null,
      artist_en: song?.master_songs?.artist_en || null,
      artworkUrl: song?.master_songs?.artwork_url || null,
      videoId: song?.video?.video_id || '',
      startSec: song?.start_sec || 0,
      endSec: song?.end_sec || 0,
      channelName: song?.video?.channels?.name || null,
      thumbnailUrl: song?.video?.thumbnail_url || null,
      videoTitle: song?.video?.title || null
    };
  };

  const handlePlayAll = () => {
    const playerSongs = items.map(toPlayerSong);
    if (playerSongs.length > 0) {
      playWithSource(playerSongs[0], playerSongs, 'playlist', playlist.id.toString());
    }
  };

  const handlePlaySong = (item: any) => {
    if (isEditing) return; // 編集モード時は再生しない
    const playerSongs = items.map(toPlayerSong);
    const index = items.findIndex(i => i.id === item.id);
    playWithSource(playerSongs[index], playerSongs, 'playlist', playlist.id.toString());
  };

  const handleRemove = async (itemId: number) => {
    if (!confirm(T('playlist.removeConfirm'))) return;

    startTransition(async () => {
      const result = await removeSongFromPlaylist(playlist.id, itemId);
      if (result.success) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        alert(result.error);
      }
    });
  };

  const handleSaveChanges = async () => {
    startTransition(async () => {
      // 1. 基本情報の更新
      const playlistRes = await updatePlaylist(playlist.id, {
        name: editName,
        description: editDescription,
        is_public: editIsPublic
      });

      if (!playlistRes.success) {
        alert(playlistRes.error);
        return;
      }

      // 2. 順序の更新（もし並び順が変わっていれば）
      const hasOrderChanged = items.some((item, index) => item.position !== index);
      if (hasOrderChanged) {
        const orderRes = await updatePlaylistOrder(playlist.id, items.map(i => i.id));
        if (!orderRes.success) {
          alert(orderRes.error);
          return;
        }
      }

      setIsEditing(false);
      // 詳細ページなので再検証でデータが更新されるはず
    });
  };

  const handleCancelEdit = () => {
    setEditName(playlist.name);
    setEditDescription(playlist.description || '');
    setEditIsPublic(playlist.is_public);
    setItems(playlist.items);
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-32">
      {/* プレイリストヘッダー */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-8 mb-8 flex flex-col md:flex-row gap-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="w-48 h-48 bg-gradient-to-br from-[#ff4e8e] to-[#ff8e4e] rounded-2xl flex items-center justify-center text-white shadow-2xl shrink-0 mx-auto md:mx-0 relative z-10">
          <ListMusic size={80} />
        </div>

        <div className="flex-1 flex flex-col justify-end text-center md:text-left relative z-10">
          {!isEditing ? (
            <>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2 text-xs font-bold text-[var(--text-tertiary)]">
                {playlist.is_public ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20">
                    <Globe size={14} /> {T('playlist.publicLabel')}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                    <Lock size={14} /> {T('playlist.privateLabel')}
                  </div>
                )}
                <span>•</span>
                <span>{items.length} {T('playlist.songCount')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-[var(--text-primary)]">
                {playlist.is_favorites ? T('playlist.favorites') : playlist.name}
              </h1>
              <p className="text-[var(--text-secondary)] text-lg mb-6 max-w-2xl font-medium leading-relaxed">
                {playlist.is_favorites ? T('playlist.favoritesDescription') : (playlist.description || T('playlist.noDescription'))}
              </p>
            </>
          ) : (
            <div className="space-y-4 mb-6">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--text-primary)]"
                  placeholder={T('playlist.name')}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none h-24"
                  placeholder={T('playlist.description')}
                />
              <label className="flex items-center gap-3 cursor-pointer select-none group/toggle w-fit">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-[var(--bg-hover)] rounded-full peer peer-checked:bg-[var(--accent)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                </div>
                <span className="text-sm font-bold text-[var(--text-tertiary)] group-hover/toggle:text-[var(--text-primary)] transition-colors">
                  {T('playlist.makePublic')}
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-center md:justify-start gap-4">
            {!isEditing ? (
              <>
                <button
                  onClick={handlePlayAll}
                  disabled={items.length === 0}
                  className="flex items-center gap-2 px-8 py-3 bg-[#ff4e8e] hover:bg-[#ff4e8e]/90 text-white font-bold rounded-full shadow-lg shadow-[#ff4e8e]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play fill="currentColor" size={20} />
                  {T('playlist.playAll')}
                </button>
                {!playlist.is_favorites && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold rounded-full border border-[var(--border)] transition-all active:scale-95"
                  >
                    <Pencil size={18} />
                    {T('common.edit')}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveChanges}
                  disabled={isPending || !editName.trim()}
                  className="flex items-center gap-2 px-8 py-3 bg-[#ff4e8e] hover:bg-[#ff4e8e]/90 text-white font-bold rounded-full shadow-lg shadow-[#ff4e8e]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {T('common.save')}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold rounded-full transition-all disabled:opacity-50"
                >
                  <X size={20} />
                  {T('common.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 楽曲リスト */}
      {displayItems.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-20 text-center text-[var(--text-tertiary)] flex flex-col items-center gap-4 shadow-xl">
          <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center">
            <ListMusic size={32} />
          </div>
          <p className="font-medium">{T('playlist.noSongs')}</p>
        </div>
      ) : (
        <SongList 
          items={displayItems}
          mapToPlayerSong={toPlayerSong}
          sourceType="playlist"
          sourceId={playlist.id.toString()}
          showVideoInfo={true}
          isReorderable={isEditing}
          onReorder={setItems}
          renderActions={playlist.is_favorites ? undefined : (item) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item.id);
              }}
              disabled={isPending}
              className="p-2.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
              title={T('common.delete')}
            >
              <Trash2 size={18} />
            </button>
          )}
        />
      )}
    </div>
  );
}
