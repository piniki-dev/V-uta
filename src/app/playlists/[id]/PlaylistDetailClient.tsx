'use client';

import { useState, useTransition, useEffect } from 'react';
import { removeSongFromPlaylist, updatePlaylist, updatePlaylistOrder } from '../actions';
import type { Playlist, PlaylistItem, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Play, Trash2, ListMusic, Globe, Lock, Loader2, ExternalLink, Pencil, Save, X, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { Reorder, motion, AnimatePresence } from 'framer-motion';

interface Props {
  playlist: Playlist & { items: any[] };
}

export default function PlaylistDetailClient({ playlist }: Props) {
  const { play, state } = usePlayer();
  const [items, setItems] = useState(playlist.items);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editDescription, setEditDescription] = useState(playlist.description || '');
  const [editIsPublic, setEditIsPublic] = useState(playlist.is_public);
  const [isPending, startTransition] = useTransition();

  // 外部からの更新（追加など）があった場合に同期
  useEffect(() => {
    setItems(playlist.items);
  }, [playlist.items]);

  const toPlayerSong = (item: any): PlayerSong => {
    const song = item.songs;
    return {
      id: song.id,
      title: song.master_songs.title,
      artist: song.master_songs.artist,
      artworkUrl: song.master_songs.artwork_url,
      videoId: song.video.video_id,
      startSec: song.start_sec,
      endSec: song.end_sec,
      channelName: song.video.channels?.name || null,
      thumbnailUrl: song.video.thumbnail_url,
      videoTitle: song.video.title
    };
  };

  const handlePlayAll = () => {
    const playerSongs = items.map(toPlayerSong);
    if (playerSongs.length > 0) {
      play(playerSongs[0], playerSongs);
    }
  };

  const handlePlaySong = (item: any) => {
    if (isEditing) return; // 編集モード時は再生しない
    const playerSongs = items.map(toPlayerSong);
    const index = items.findIndex(i => i.id === item.id);
    play(playerSongs[index], playerSongs);
  };

  const handleRemove = async (itemId: number) => {
    if (!confirm('この楽曲をプレイリストから削除しますか？')) return;

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
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 flex flex-col md:flex-row gap-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff4e8e]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="w-48 h-48 bg-gradient-to-br from-[#ff4e8e] to-[#ff8e4e] rounded-2xl flex items-center justify-center text-white shadow-2xl shrink-0 mx-auto md:mx-0 relative z-10">
          <ListMusic size={80} />
        </div>

        <div className="flex-1 flex flex-col justify-end text-center md:text-left relative z-10">
          {!isEditing ? (
            <>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2 text-xs font-bold text-[#666]">
                {playlist.is_public ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20">
                    <Globe size={14} /> 公開プレイリスト
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                    <Lock size={14} /> 非公開プレイリスト
                  </div>
                )}
                <span>•</span>
                <span>{items.length} 曲</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">{playlist.name}</h1>
              <p className="text-[#999] text-lg mb-6 max-w-2xl font-medium leading-relaxed">
                {playlist.description || '説明はありません'}
              </p>
            </>
          ) : (
            <div className="space-y-4 mb-6">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:border-[#ff4e8e] transition-colors"
                placeholder="プレイリスト名"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#999] focus:outline-none focus:border-[#ff4e8e] transition-colors resize-none h-24"
                placeholder="プレイリストの説明"
              />
              <label className="flex items-center gap-3 cursor-pointer select-none group/toggle w-fit">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-[#333] rounded-full peer peer-checked:bg-[#ff4e8e] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                </div>
                <span className="text-sm font-bold text-[#888] group-hover/toggle:text-white transition-colors">
                  プレイリストを公開する
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
                  すべて再生
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/10 transition-all active:scale-95"
                >
                  <Pencil size={18} />
                  編集
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveChanges}
                  disabled={isPending || !editName.trim()}
                  className="flex items-center gap-2 px-8 py-3 bg-[#ff4e8e] hover:bg-[#ff4e8e]/90 text-white font-bold rounded-full shadow-lg shadow-[#ff4e8e]/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  変更を保存
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-transparent hover:bg-white/5 text-[#999] hover:text-white font-bold rounded-full transition-all disabled:opacity-50"
                >
                  <X size={20} />
                  キャンセル
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 楽曲リスト */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h2 className="font-bold flex items-center gap-2 text-white/60 text-sm">
            <ListMusic size={18} />
            楽曲リスト
          </h2>
          {isEditing && (
            <span className="text-xs font-bold text-[#ff4e8e] animate-pulse">
              ドラッグして順序を入れ替えられます
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-20 text-center text-[#666] flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center">
              <ListMusic size={32} />
            </div>
            <p className="font-medium">楽曲が登録されていません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* ヘッダー行 */}
              <div className="grid grid-cols-[60px_1fr_1fr_100px_80px] px-8 py-4 border-b border-white/5 text-[#666] text-xs font-bold uppercase tracking-widest gap-4">
                <div className="text-center">#</div>
                <div>曲名 / アーティスト</div>
                <div>アーカイブ</div>
                <div className="text-right">長さ</div>
                <div></div>
              </div>

              <Reorder.Group axis="y" values={items} onReorder={setItems} className="divide-y divide-white/5">
                {items.map((item, index) => {
                  const song = item.songs;
                  if (!song) return null;
                  return (
                    <Reorder.Item 
                      key={item.id} 
                      value={item}
                      dragListener={isEditing}
                      className={`relative grid grid-cols-[60px_1fr_1fr_100px_80px] px-8 py-4 gap-4 items-center transition-colors ${
                        isEditing ? 'hover:bg-white/[0.02] cursor-grab active:cursor-grabbing' : 'hover:bg-white/5 cursor-pointer'
                      }`}
                      onClick={() => handlePlaySong(item)}
                    >
                      <div className="flex items-center justify-center text-[#666] font-bold text-sm tabular-nums">
                        {isEditing ? <GripVertical size={16} className="text-[#444]" /> : index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-[#e0e0e0] truncate group-hover:text-[#ff4e8e] transition-colors">{song.master_songs.title}</div>
                        <div className="text-sm text-[#666] truncate">{song.master_songs.artist}</div>
                      </div>

                      <div className="min-w-0">
                        <Link 
                          href={`/videos/${song.video.video_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-[#666] hover:text-[#ff4e8e] transition-colors flex items-center gap-1.5"
                        >
                          <span className="truncate">{song.video.title}</span>
                          <ExternalLink size={12} className="shrink-0 opacity-40" />
                        </Link>
                      </div>

                      <div className="text-right text-[#666] font-bold text-sm tabular-nums">
                        {formatTime(song.end_sec - song.start_sec)}
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(item.id);
                          }}
                          disabled={isPending}
                          className="p-2.5 text-[#444] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
