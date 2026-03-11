'use client';

import { useState, useTransition } from 'react';
import { fetchVideoPreview, registerVideo, registerSong } from './actions';
import type { YouTubeVideoMetadata, Video, Song } from '@/types';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';

export default function NewSongPage() {
  // Step 1: URL 入力
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [video, setVideo] = useState<Video | null>(null);

  // Step 2: 曲情報入力
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

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

  const handleRegisterSong = () => {
    setError('');
    setSuccess('');
    if (!video) return;

    startTransition(async () => {
      const result = await registerSong({
        videoDbId: video.id,
        title: songTitle,
        artist,
        startTime,
        endTime,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // 登録済みリストに追加
      setRegisteredSongs((prev) => [...prev, result.data]);
      setSuccess(`「${result.data.title}」を登録しました！ 続けて次の曲を入力できます。`);
      // 曲フォームだけリセット（動画はそのまま）
      setSongTitle('');
      setArtist('');
      setStartTime('');
      setEndTime('');
    });
  };

  const handleReset = () => {
    setUrl('');
    setMetadata(null);
    setVideo(null);
    setSongTitle('');
    setArtist('');
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

      {/* Step 2: 曲情報入力 */}
      {step === 2 && (
        <>
          <div className="card">
            <div className="card__header">
              <span className="card__step">2</span>
              <h2 className="card__title">曲情報</h2>
              {registeredSongs.length > 0 && (
                <span className="card__badge">
                  {registeredSongs.length} 曲登録済み
                </span>
              )}
            </div>
            <div className="card__body">
              <div className="form-group">
                <label htmlFor="song-title" className="form-label">
                  曲名 <span className="form-required">*</span>
                </label>
                <input
                  id="song-title"
                  type="text"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="例: 夜に駆ける"
                  className="form-input"
                  disabled={isPending}
                />
              </div>

              <div className="form-group">
                <label htmlFor="artist" className="form-label">
                  アーティスト名
                </label>
                <input
                  id="artist"
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="例: YOASOBI"
                  className="form-input"
                  disabled={isPending}
                />
              </div>

              <div className="form-row">
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
                disabled={isPending || !songTitle.trim() || !startTime || !endTime}
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
                        <span className="registered-songs__title">{song.title}</span>
                        <span className="registered-songs__artist">
                          {song.artist || '-'}
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
