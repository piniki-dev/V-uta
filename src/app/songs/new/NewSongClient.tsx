'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { fetchVideoPreview, registerVideo, registerSong, searchSongAction } from './actions';
import type { ITunesSearchResult } from './actions';
import type { YouTubeVideoMetadata, Video, Song } from '@/types';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Search, X, Music } from 'lucide-react';

/** 秒数を "mm:ss" に変換 */
function secondsToMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function NewSongClient() {
  // Step 1: URL 入力
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [video, setVideo] = useState<Video | null>(null);

  // Step 2: 曲検索・選択
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ITunesSearchResult[]>([]);
  const [selectedSong, setSelectedSong] = useState<ITunesSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Step 3: 区間入力
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // 開始時間変更時に曲の長さから終了時間を自動入力
  useEffect(() => {
    if (!selectedSong || !startTime) {
      return;
    }
    const match = startTime.match(/^(\d{1,3}):(\d{2})$/);
    if (!match) return;
    const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
    if (isNaN(startSec) || selectedSong.durationSec <= 0) return;
    const endSec = startSec + selectedSong.durationSec;
    setEndTime(secondsToMmSs(endSec));
  }, [startTime, selectedSong]);

  // 登録済み曲リスト（このセッションで登録したもの）
  const [registeredSongs, setRegisteredSongs] = useState<Song[]>([]);

  // UI 状態
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);

  const handleFetchVideo = () => {
    setError('');
    setSuccess('');
    startTransition(async () => {
      const result = await fetchVideoPreview(url);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMetadata(result.data);

      // videos テーブルに登録
      const videoResult = await registerVideo(result.data);
      if (!videoResult.success) {
        setError(videoResult.error);
        return;
      }
      setVideo(videoResult.data);
      setStep(2);
    });
  };

  // iTunes 検索をデバウンスして呼び出す
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError('');
    try {
      const result = await searchSongAction(searchQuery);
      if (result.success) {
        setSearchResults(result.data);
      } else {
        setError(result.error);
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectSong = (track: ITunesSearchResult) => {
    setSelectedSong(track);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    setSelectedSong(null);
  };

  const handleRegisterSong = () => {
    setError('');
    setSuccess('');
    if (!video || !selectedSong) return;

    startTransition(async () => {
      const result = await registerSong({
        videoDbId: video.id,
        songTitle: selectedSong.title,
        songArtist: selectedSong.artist,
        artworkUrl: selectedSong.artworkUrl,
        itunesId: String(selectedSong.trackId),
        durationSec: selectedSong.durationSec,
        startTime,
        endTime,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // 登録済みリストに追加
      setRegisteredSongs((prev) => [...prev, result.data]);
      const title = result.data.master_songs?.title || selectedSong.title;
      setSuccess(`「${title}」を登録しました！ 続けて次の曲を入力できます。`);
      // 曲フォームだけリセット（動画はそのまま）
      setSelectedSong(null);
      setSearchQuery('');
      setStartTime('');
      setEndTime('');
    });
  };

  const handleReset = () => {
    setUrl('');
    setMetadata(null);
    setVideo(null);
    setSelectedSong(null);
    setSearchQuery('');
    setSearchResults([]);
    setStartTime('');
    setEndTime('');
    setError('');
    setSuccess('');
    setStep(1);
    setRegisteredSongs([]);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">歌を登録</h1>
      <p className="page-description">
        YouTube 歌枠アーカイブから曲の区間を登録します。
        1つのアーカイブから複数の曲を連続で登録できます。
      </p>

      {/* エラー・成功メッセージ */}
      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {/* Step 1: YouTube URL 入力 */}
      <div className={`card ${step === 1 ? '' : 'card--completed'}`}>
        <div className="card__header">
          <span className="card__step">1</span>
          <h2 className="card__title">アーカイブ URL</h2>
          {step === 2 && (
            <button onClick={handleReset} className="card__change-btn">
              変更
            </button>
          )}
        </div>

        {step === 1 ? (
          <div className="card__body">
            <div className="form-group">
              <label htmlFor="youtube-url" className="form-label">
                YouTube URL
              </label>
              <div className="form-input-group">
                <input
                  id="youtube-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="form-input"
                  disabled={isPending}
                />
                <button
                  onClick={handleFetchVideo}
                  disabled={isPending || !url.trim()}
                  className="btn btn--primary"
                >
                  {isPending ? '取得中...' : '取得'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          metadata && (
            <div className="card__body">
              <div className="video-preview">
                {metadata.thumbnailUrl && (
                  <img
                    src={metadata.thumbnailUrl}
                    alt={metadata.title}
                    className="video-preview__thumbnail"
                  />
                )}
                <div className="video-preview__info">
                  <p className="video-preview__title">{metadata.title}</p>
                  <p className="video-preview__channel">{metadata.channelName}</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Step 2: 曲検索 + 区間入力 */}
      {step === 2 && (
        <>
          <div className="card">
            <div className="card__header">
              <span className="card__step">2</span>
              <h2 className="card__title">曲を検索</h2>
              {registeredSongs.length > 0 && (
                <span className="card__badge">
                  {registeredSongs.length} 曲登録済み
                </span>
              )}
            </div>
            <div className="card__body">
              {/* 選択済みの曲カード */}
              {selectedSong ? (
                <div className="selected-song">
                  <img
                    src={selectedSong.artworkUrl}
                    alt={selectedSong.title}
                    className="selected-song__artwork"
                  />
                  <div className="selected-song__info">
                    <span className="selected-song__title">{selectedSong.title}</span>
                    <span className="selected-song__artist">{selectedSong.artist}</span>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="selected-song__clear"
                    title="選択を解除"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  {/* 検索バー */}
                  <div className="form-group">
                    <label htmlFor="song-search" className="form-label">
                      曲名で検索 <span className="form-required">*</span>
                    </label>
                    <div className="form-input-group">
                      <input
                        id="song-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearch();
                          }
                        }}
                        placeholder="例: 夜に駆ける"
                        className="form-input"
                        disabled={isSearching}
                      />
                      <button
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery.trim()}
                        className="btn btn--primary"
                      >
                        {isSearching ? '検索中...' : <Search size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* 検索結果一覧 */}
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map((track) => (
                        <button
                          key={track.trackId}
                          onClick={() => handleSelectSong(track)}
                          className="search-results__item"
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
                </>
              )}

              {/* 区間入力 */}
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="start-time" className="form-label">
                    開始時間 <span className="form-required">*</span>
                  </label>
                  <input
                    id="start-time"
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="mm:ss"
                    className="form-input"
                    disabled={isPending}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end-time" className="form-label">
                    終了時間 <span className="form-required">*</span>
                  </label>
                  <input
                    id="end-time"
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="mm:ss"
                    className="form-input"
                    disabled={isPending}
                  />
                </div>
              </div>

              <button
                onClick={handleRegisterSong}
                disabled={isPending || !selectedSong || !startTime || !endTime}
                className="btn btn--primary btn--full"
              >
                {isPending ? '登録中...' : '歌を登録'}
              </button>
            </div>
          </div>

          {/* 登録済み曲リスト */}
          {registeredSongs.length > 0 && (
            <div className="card">
              <div className="card__header">
                <span className="card__step">✓</span>
                <h2 className="card__title">
                  このアーカイブに登録した曲（{registeredSongs.length} 曲）
                </h2>
              </div>
              <div className="card__body" style={{ padding: 0 }}>
                <div className="registered-songs">
                  {registeredSongs.map((song, index) => (
                    <div key={song.id} className="registered-songs__item">
                      <span className="registered-songs__num">{index + 1}</span>
                      <div className="registered-songs__info">
                        <span className="registered-songs__title">
                          {song.master_songs?.title || '(不明)'}
                        </span>
                        <span className="registered-songs__artist">
                          {song.master_songs?.artist || '-'}
                        </span>
                      </div>
                      <span className="registered-songs__time">
                        {formatTime(song.start_sec)} - {formatTime(song.end_sec)}
                      </span>
                      <span className="registered-songs__duration">
                        {formatTime(song.end_sec - song.start_sec)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* アーカイブページへのリンク */}
                {video && (
                  <div className="registered-songs__footer">
                    <Link
                      href={`/videos/${video.video_id}`}
                      className="btn btn--secondary"
                    >
                      アーカイブページで確認する →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
