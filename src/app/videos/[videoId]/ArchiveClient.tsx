'use client';

import type { Video, Song, PlayerSong } from '@/types';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Pencil } from 'lucide-react';

interface Props {
  video: Video;
  songs: Song[];
}

function toPlayerSong(song: Song, video: Video): PlayerSong {
  return {
    id: song.id,
    title: song.master_songs?.title || '(不明)',
    artist: song.master_songs?.artist || null,
    artworkUrl: song.master_songs?.artwork_url || null,
    videoId: video.video_id,
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: video.channel_name,
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  };
}

export default function ArchiveClient({ video, songs }: Props) {
  const { play, state } = usePlayer();

  const playerSongs = songs.map((s) => toPlayerSong(s, video));

  const handlePlaySong = (song: Song) => {
    const ps = toPlayerSong(song, video);
    play(ps, playerSongs);
  };

  const handlePlayAll = () => {
    if (playerSongs.length > 0) {
      play(playerSongs[0], playerSongs);
    }
  };

  return (
    <div className="page-container">
      {/* 動画情報ヘッダー */}
      <div className="archive-header">
        <div className="archive-header__thumbnail-wrap">
          {video.thumbnail_url && (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="archive-header__thumbnail"
            />
          )}
          <div className="archive-header__overlay">
            <button
              onClick={handlePlayAll}
              className="archive-header__play-all"
              disabled={songs.length === 0}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="archive-header__info">
          <h1 className="archive-header__title">{video.title}</h1>
          {video.channels ? (
            <Link href={`/channels/${video.channels.handle || video.channels.id}`} className="archive-header__channel hover:underline">
              {video.channels.name}
            </Link>
          ) : (
            <p className="archive-header__channel">{video.channel_name}</p>
          )}
          <div className="archive-header__meta">
            <span>{songs.length} 曲</span>
            <a
              href={`https://www.youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="archive-header__youtube-link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
              YouTube で見る
            </a>
          </div>
          <Link 
            href={`/songs/new?url=https://www.youtube.com/watch?v=${video.video_id}`} 
            className="btn btn--secondary btn--sm"
          >
            <Pencil size={14} />
            曲を編集
          </Link>
        </div>
      </div>

      {/* 曲リスト */}
      {songs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__text">
            まだ曲が登録されていません
          </p>
          <Link href="/songs/new" className="btn btn--primary">
            歌を登録する
          </Link>
        </div>
      ) : (
        <div className="song-list">
          <div className="song-list__header">
            <span className="song-list__col-num">#</span>
            <span className="song-list__col-title">曲名</span>
            <span className="song-list__col-artist">アーティスト</span>
            <span className="song-list__col-time">区間</span>
            <span className="song-list__col-duration">長さ</span>
          </div>

          {songs.map((song, index) => {
            const isCurrentSong = state.currentSong?.id === song.id;
            return (
              <button
                key={song.id}
                onClick={() => handlePlaySong(song)}
                className={`song-list__item ${isCurrentSong ? 'active' : ''}`}
              >
                <span className="song-list__col-num">
                  {isCurrentSong && state.isPlaying ? (
                    <span className="song-list__playing-icon">♪</span>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="song-list__col-title">{song.master_songs?.title || '(不明)'}</span>
                <span className="song-list__col-artist">{song.master_songs?.artist || '-'}</span>
                <span className="song-list__col-time">
                  {formatTime(song.start_sec)} - {formatTime(song.end_sec)}
                </span>
                <span className="song-list__col-duration">
                  {formatTime(song.end_sec - song.start_sec)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
