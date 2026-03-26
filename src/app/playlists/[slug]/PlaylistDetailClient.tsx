'use client';

import { useState, useTransition, useEffect } from 'react';
import { removeSongFromPlaylist, updatePlaylist, updatePlaylistOrder } from '../actions';
import type { Playlist, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { Play, Trash2, ListMusic, Loader2, Pencil, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import SongList from '@/components/song/SongList';
import { useLocale } from '@/components/LocaleProvider';
import { useFavorites } from '@/components/FavoritesProvider';

interface Props {
  playlist: Playlist & { items: any[] };
}

export default function PlaylistDetailClient({ playlist }: Props) {
  const { playWithSource } = usePlayer();
  const { T } = useLocale();
  const { favoriteIds } = useFavorites();
  const [items, setItems] = useState(playlist.items);
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* プレイリストヘッダー */}
      <motion.section 
        className="relative overflow-hidden border-b border-[var(--border)] py-16 mesh-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/5 to-[var(--bg-primary)]/10 pointer-events-none" />
        
        <div className="container relative z-10 w-full px-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
            {/* プレイリストアートワーク/アイコン */}
            <motion.div 
              className="relative group/artwork"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-3xl blur-2xl opacity-0 group-hover/artwork:opacity-100 transition-opacity duration-700" />
              <div className="w-56 h-56 bg-gradient-to-br from-[#ff4e8e] to-[#8e4eff] rounded-3xl flex items-center justify-center text-white shadow-2xl relative z-10 overflow-hidden ring-4 ring-white/10 group-hover/artwork:scale-105 transition-transform duration-500">
                <ListMusic size={90} className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/artwork:opacity-100 transition-opacity" />
              </div>
            </motion.div>

            <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              {!isEditing ? (
                <>
                  <motion.div 
                    className="flex items-center gap-3 mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1.5 rounded-full border border-[var(--border)] shadow-sm">
                      Playlist • {items.length} {T('playlist.songCount')}
                    </span>
                  </motion.div>

                  <motion.h1 
                    className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-[var(--text-primary)] glow-text drop-shadow-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {playlist.is_favorites ? T('playlist.favorites') : playlist.name}
                  </motion.h1>

                  <motion.p 
                    className="text-[var(--text-secondary)] text-lg md:text-xl mb-8 max-w-2xl font-medium leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {playlist.is_favorites ? T('playlist.favoritesDescription') : (playlist.description || T('playlist.noDescription'))}
                  </motion.p>
                </>
              ) : (
                <motion.div 
                  className="w-full space-y-5 mb-8"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)]/50 backdrop-blur-md border border-[var(--border)] rounded-2xl px-6 py-4 text-3xl font-bold focus:outline-none focus:border-[var(--accent)] transition-all text-[var(--text-primary)] shadow-inner"
                    placeholder={T('playlist.name')}
                    autoFocus
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)]/50 backdrop-blur-md border border-[var(--border)] rounded-2xl px-6 py-4 text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all resize-none h-32"
                    placeholder={T('playlist.description')}
                  />
                </motion.div>
              )}

              <motion.div 
                className="flex items-center gap-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
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
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

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
