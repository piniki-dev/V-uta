'use client';

import { useState, useTransition, useEffect } from 'react';
import { removeSongFromPlaylist, updatePlaylist, updatePlaylistOrder } from '../actions';
import type { Playlist, PlaylistItem, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { Play, Trash2, ListMusic, Loader2, Pencil, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import SongList from '@/components/song/SongList';
import Hero from '@/components/Hero';
import { useLocale } from '@/components/LocaleProvider';
import { useFavorites } from '@/components/FavoritesProvider';

interface Props {
  playlist: Playlist & { items: PlaylistItem[] };
}

export default function PlaylistDetailContent({ playlist }: Props) {
  const { playWithSource } = usePlayer();
  const { T } = useLocale();
  const { favoriteIds } = useFavorites();
  const [items, setItems] = useState<PlaylistItem[]>(playlist.items);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editDescription, setEditDescription] = useState(playlist.description || '');
  const [isPending, startTransition] = useTransition();

  // お気に入りプレイリストの場合、同期された favoriteIds に基づいて表示をフィルタリング
  const displayItems = playlist.is_favorites
    ? items.filter(item => item.songs && favoriteIds.has(item.songs.id))
    : items;

  // 外部からの更新（追加など）があった場合に同期
  useEffect(() => {
    if (playlist.items !== items) {
      const timer = setTimeout(() => {
        setItems(playlist.items);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [playlist.items, items]);

  const toPlayerSong = (item: PlaylistItem): PlayerSong => {
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
      channelThumbnailUrl: song?.video?.channels?.image || null,
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
      const playlistRes = await updatePlaylist(playlist.id, {
        name: editName,
        description: editDescription,
        is_public: true // 常に公開扱い
      });

      if (!playlistRes.success) {
        alert(playlistRes.error);
        return;
      }

      const hasOrderChanged = items.some((item, index) => item.position !== index);
      if (hasOrderChanged) {
        const orderRes = await updatePlaylistOrder(playlist.id, items.map(i => i.id));
        if (!orderRes.success) {
          alert(orderRes.error);
          return;
        }
      }

      setIsEditing(false);
    });
  };

  const handleCancelEdit = () => {
    setEditName(playlist.name);
    setEditDescription(playlist.description || '');
    setItems(playlist.items);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen">
      {/* プレイリストヘッダー */}
      <Hero
        title={
          !isEditing ? (
            playlist.is_favorites ? T('playlist.favorites') : playlist.name
          ) : (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[var(--bg-tertiary)]/50 backdrop-blur-md border border-[var(--border)] rounded-2xl px-6 py-2 text-3xl font-bold focus:outline-none focus:border-[var(--accent)] transition-all text-[var(--text-primary)] shadow-inner"
              placeholder={T('playlist.name')}
              autoFocus
            />
          )
        }
        description={
          !isEditing ? (
            playlist.is_favorites ? T('playlist.favoritesDescription') : (playlist.description || T('playlist.noDescription'))
          ) : (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-[var(--bg-tertiary)]/50 backdrop-blur-md border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all resize-none h-32"
              placeholder={T('playlist.description')}
            />
          )
        }
        icon={<ListMusic size={64} />}
        badge={!isEditing ? `Playlist • ${items.length} ${T('playlist.songCount')}` : undefined}
        actions={
          <div className="flex items-center gap-5">
            {!isEditing ? (
              <>
                <button
                  onClick={handlePlayAll}
                  disabled={items.length === 0}
                  className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#ff4e8e] to-[#ff8e4e] hover:from-[#ff4e8e]/90 hover:to-[#ff8e4e]/90 text-white font-black rounded-2xl shadow-2xl shadow-[#ff4e8e]/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play fill="currentColor" size={22} className="group-hover:scale-110 transition-transform" />
                  {T('playlist.playAll')}
                </button>
                {!playlist.is_favorites && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-3 px-8 py-4 bg-[var(--bg-secondary)]/50 backdrop-blur-md hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-black rounded-2xl border border-[var(--border)] transition-all active:scale-95"
                  >
                    <Pencil size={20} />
                    {T('common.edit')}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveChanges}
                  disabled={isPending || !editName.trim()}
                  className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] text-white font-black rounded-2xl shadow-2xl shadow-[var(--accent)]/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                  {T('common.save')}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isPending}
                  className="flex items-center gap-3 px-8 py-4 bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-black rounded-2xl transition-all disabled:opacity-50"
                >
                  <X size={22} />
                  {T('common.cancel')}
                </button>
              </>
            )}
          </div>
        }
      />

      {/* 楽曲リストセクション */}
      <div className="container py-20 pb-48 px-6">
        {displayItems.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl p-20 text-center text-[var(--text-tertiary)] flex flex-col items-center gap-4 shadow-xl">
            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center border border-[var(--border)]">
              <ListMusic size={32} />
            </div>
            <p className="font-bold">{T('playlist.noSongs')}</p>
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
                className="p-3 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all disabled:opacity-50 border border-transparent hover:border-red-500/20"
                title={T('common.delete')}
              >
                <Trash2 size={18} />
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}
