'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import type { Video, Song } from '@/types';
import { updateSong, deleteSong, updateSongMaster, searchSongForEdit } from './actions';
import type { ITunesSearchResult } from './actions';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Search, X, Music, Pencil } from 'lucide-react';

/** 秒数を "mm:ss" に変換 */
function secondsToMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface EditableSong {
  song: Song;
  startTime: string;
  endTime: string;
  isEditing: boolean;
  isChangingSong: boolean;
  searchQuery: string;
  searchResults: ITunesSearchResult[];
  isSearching: boolean;
}

interface Props {
  video: Video;
  songs: Song[];
}

export default function EditSongsClient({ video, songs: initialSongs }: Props) {
  const [editableSongs, setEditableSongs] = useState<EditableSong[]>(() =>
    initialSongs.map((song) => ({
      song,
      startTime: secondsToMmSs(song.start_sec),
      endTime: secondsToMmSs(song.end_sec),
      isEditing: false,
      isChangingSong: false,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
    }))
  );

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clearMessage = () => setMessage(null);

  // 個別の曲の編集モードを切り替え
  const toggleEdit = (index: number) => {
    setEditableSongs((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              isEditing: !item.isEditing,
              isChangingSong: false,
              searchQuery: '',
              searchResults: [],
              // キャンセル時は元の値に戻す
              ...(!item.isEditing
                ? {}
                : {
                    startTime: secondsToMmSs(item.song.start_sec),
                    endTime: secondsToMmSs(item.song.end_sec),
                  }),
            }
          : item
      )
    );
    clearMessage();
  };

  // 時間の入力変更
  const updateField = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setEditableSongs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // 曲の区間を保存
  const handleSave = (index: number) => {
    const item = editableSongs[index];
    clearMessage();
    startTransition(async () => {
      const result = await updateSong({
        songId: item.song.id,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      if (!result.success) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setEditableSongs((prev) =>
        prev.map((it, i) =>
          i === index
            ? { ...it, song: result.data, isEditing: false }
            : it
        )
      );
      setMessage({ type: 'success', text: '区間を更新しました' });
    });
  };

  // 曲を削除（論理削除）
  const handleDelete = (index: number) => {
    const item = editableSongs[index];
    const songName = item.song.master_songs?.title || '(不明)';
    if (!confirm(`「${songName}」を削除しますか？`)) return;

    clearMessage();
    startTransition(async () => {
      const result = await deleteSong(item.song.id);
      if (!result.success) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setEditableSongs((prev) => prev.filter((_, i) => i !== index));
      setMessage({ type: 'success', text: `「${songName}」を削除しました` });
    });
  };

  // 曲変更モードの切り替え
  const toggleChangeSong = (index: number) => {
    setEditableSongs((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, isChangingSong: !item.isChangingSong, searchQuery: '', searchResults: [] }
          : item
      )
    );
  };

  // 曲の検索
  const handleSearchSong = async (index: number) => {
    const item = editableSongs[index];
    if (!item.searchQuery.trim()) return;

    setEditableSongs((prev) =>
      prev.map((it, i) => (i === index ? { ...it, isSearching: true } : it))
    );

    const result = await searchSongForEdit(item.searchQuery);

    setEditableSongs((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              isSearching: false,
              searchResults: result.success ? result.data : [],
            }
          : it
      )
    );

    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
    }
  };

  // 検索クエリの更新
  const updateSearchQuery = (index: number, value: string) => {
    setEditableSongs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, searchQuery: value } : item))
    );
  };

  // 曲の選択（master_songsを変更）
  const handleSelectNewSong = (index: number, track: ITunesSearchResult) => {
    clearMessage();
    startTransition(async () => {
      const item = editableSongs[index];
      const result = await updateSongMaster({
        songId: item.song.id,
        songTitle: track.title,
        songArtist: track.artist,
        artworkUrl: track.artworkUrl,
        itunesId: String(track.trackId),
        durationSec: track.durationSec,
      });
      if (!result.success) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setEditableSongs((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                song: result.data,
                isChangingSong: false,
                searchQuery: '',
                searchResults: [],
              }
            : it
        )
      );
      setMessage({ type: 'success', text: `曲を「${track.title}」に変更しました` });
    });
  };

  return (
    <div className="page-container">
      {/* ヘッダー */}
      <div className="edit-header">
        <Link href={`/videos/${video.video_id}`} className="edit-header__back">
          <ArrowLeft size={20} />
          戻る
        </Link>
        <div className="edit-header__info">
          <h1 className="edit-header__title">曲の編集</h1>
          <p className="edit-header__video-title">{video.title}</p>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`alert alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 曲リスト */}
      {editableSongs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__text">
            このアーカイブにはまだ曲が登録されていません。
          </p>
          <Link href="/songs/new" className="btn btn--primary">
            歌を登録する
          </Link>
        </div>
      ) : (
        <div className="edit-songs">
          {editableSongs.map((item, index) => (
            <div
              key={item.song.id}
              className={`edit-songs__card ${item.isEditing ? 'edit-songs__card--active' : ''}`}
            >
              {/* 曲情報 */}
              <div className="edit-songs__info-row">
                <span className="edit-songs__num">{index + 1}</span>
                {item.song.master_songs?.artwork_url && (
                  <img
                    src={item.song.master_songs.artwork_url}
                    alt={item.song.master_songs.title}
                    className="edit-songs__artwork"
                  />
                )}
                <div className="edit-songs__info">
                  <span className="edit-songs__title">
                    {item.song.master_songs?.title || '(不明)'}
                  </span>
                  <span className="edit-songs__artist">
                    {item.song.master_songs?.artist || '-'}
                  </span>
                </div>
                <div className="edit-songs__actions">
                  <button
                    onClick={() => toggleEdit(index)}
                    className="edit-songs__btn"
                    title={item.isEditing ? 'キャンセル' : '編集'}
                  >
                    {item.isEditing ? <X size={16} /> : <Pencil size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="edit-songs__btn edit-songs__btn--danger"
                    title="削除"
                    disabled={isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 編集フォーム */}
              {item.isEditing && (
                <div className="edit-songs__form">
                  {/* 曲変更 */}
                  <button
                    onClick={() => toggleChangeSong(index)}
                    className="edit-songs__change-song-btn"
                  >
                    <Music size={14} />
                    {item.isChangingSong ? '曲の変更をキャンセル' : '曲を変更する'}
                  </button>

                  {item.isChangingSong && (
                    <div className="edit-songs__search">
                      <div className="form-input-group">
                        <input
                          type="text"
                          value={item.searchQuery}
                          onChange={(e) => updateSearchQuery(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchSong(index);
                            }
                          }}
                          placeholder="曲名で検索..."
                          className="form-input"
                          disabled={item.isSearching}
                        />
                        <button
                          onClick={() => handleSearchSong(index)}
                          disabled={item.isSearching || !item.searchQuery.trim()}
                          className="btn btn--primary"
                        >
                          {item.isSearching ? '...' : <Search size={16} />}
                        </button>
                      </div>

                      {item.searchResults.length > 0 && (
                        <div className="search-results">
                          {item.searchResults.map((track) => (
                            <button
                              key={track.trackId}
                              onClick={() => handleSelectNewSong(index, track)}
                              className="search-results__item"
                              disabled={isPending}
                            >
                              <img
                                src={track.artworkUrl}
                                alt={track.title}
                                className="search-results__artwork"
                              />
                              <div className="search-results__info">
                                <span className="search-results__title">{track.title}</span>
                                <span className="search-results__artist">{track.artist}</span>
                              </div>
                              <Music size={16} className="search-results__icon" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 区間編集 */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">開始時間</label>
                      <input
                        type="text"
                        value={item.startTime}
                        onChange={(e) => updateField(index, 'startTime', e.target.value)}
                        placeholder="mm:ss"
                        className="form-input"
                        disabled={isPending}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">終了時間</label>
                      <input
                        type="text"
                        value={item.endTime}
                        onChange={(e) => updateField(index, 'endTime', e.target.value)}
                        placeholder="mm:ss"
                        className="form-input"
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleSave(index)}
                    disabled={isPending}
                    className="btn btn--primary btn--full"
                  >
                    <Save size={16} />
                    {isPending ? '保存中...' : '区間を保存'}
                  </button>
                </div>
              )}

              {/* 非編集時の区間表示 */}
              {!item.isEditing && (
                <div className="edit-songs__time-info">
                  {formatTime(item.song.start_sec)} - {formatTime(item.song.end_sec)}
                  <span className="edit-songs__duration">
                    ({formatTime(item.song.end_sec - item.song.start_sec)})
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
