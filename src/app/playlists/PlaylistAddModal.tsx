'use client';

import { useState, useEffect, useTransition } from 'react';
import { getPlaylists, createPlaylist, addSongToPlaylist } from './actions';
import type { Playlist } from '@/types';
import { Plus, Check, Loader2, X, Lock, Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';


interface Props {
  songId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PlaylistAddModal({ songId, onClose, onSuccess }: Props) {
  const { T } = useLocale();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdPlaylistId, setCreatedPlaylistId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setIsLoading(true);
    const result = await getPlaylists();
    if (result.success && result.data) {
      // 自分のプレイリストのみ表示（追加するため）
      setPlaylists(result.data);
    }
    setIsLoading(false);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;

    startTransition(async () => {
      const createRes = await createPlaylist(newPlaylistName, '', isPublic);
      if (!createRes.success) {
        setError(createRes.error || 'プレイリストの作成に失敗しました');
        return;
      }

      if (createRes.data) {
        const addRes = await addSongToPlaylist(createRes.data.id, songId);
        if (addRes.success) {
          setSuccess('プレイリストを作成し、楽曲を追加しました');
          setCreatedPlaylistId(createRes.data.id);
          // リンクを表示するため、自動で閉じないようにするか時間を延ばす
          setTimeout(() => {
            onSuccess?.();
          }, 3000);
        } else {
          setError(addRes.error || '楽曲の追加に失敗しました');
        }
      }
    });
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    startTransition(async () => {
      const result = await addSongToPlaylist(playlistId, songId);
      if (result.success) {
        setSuccess('プレイリストに楽曲を追加しました');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(result.error || '追加に失敗しました');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-bold text-lg">{T('playlist.add')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl">
              <div className="flex items-center gap-2 mb-2 font-bold">
                <Check size={18} />
                {success}
              </div>
              {createdPlaylistId && (
                <Link 
                  href={`/playlists/${createdPlaylistId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-xs font-bold transition-colors"
                >
                  {T('common.details')}
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-tertiary)] gap-3">
              <Loader2 className="animate-spin" />
              <p className="text-sm">{T('common.loading')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id)}
                    disabled={isPending}
                    className="w-full p-3 flex items-center gap-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-xl transition-all text-left group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                      {playlist.is_public ? <Globe size={18} /> : <Lock size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-[var(--text-primary)]">{playlist.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{playlist.is_public ? T('playlist.public') : T('playlist.private')}</p>
                    </div>
                    <Plus size={18} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-[var(--text-tertiary)]">
                  <p className="text-sm">{T('playlist.noPlaylists')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border)]">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full p-3 flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-90 text-white font-bold rounded-xl transition-all"
            >
              <Plus size={18} />
              {T('playlist.createAndAdd')}
            </button>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={T('playlist.enterName')}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[var(--bg-hover)] rounded-full peer peer-checked:bg-[var(--accent)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">{T('playlist.makePublic')}</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-sm font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {T('common.cancel')}
                  </button>
                  <button
                    onClick={handleCreateAndAdd}
                    disabled={!newPlaylistName.trim() || isPending}
                    className="px-4 py-2 bg-[var(--accent)] disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all"
                  >
                    {T('playlist.createAndAdd')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
