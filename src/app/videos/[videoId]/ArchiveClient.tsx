'use client';

import type { Video, Song, PlayerSong } from '@/types';
import { useState } from 'react';
import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import Link from 'next/link';
import { Pencil, ListPlus, MoreVertical, Globe, ExternalLink } from 'lucide-react';
import SongMenu from '@/components/song/SongMenu';
import { useLocale } from '@/components/LocaleProvider';

interface Props {
  video: Video;
  songs: Song[];
}

function toPlayerSong(song: Song, video: Video, T: (key: string) => string): PlayerSong {
  return {
    id: song.id,
    title: song.master_songs?.title || T('common.unknown'),
    artist: song.master_songs?.artist || null,
    title_en: song.master_songs?.title_en || null,
    artist_en: song.master_songs?.artist_en || null,
    artworkUrl: song.master_songs?.artwork_url || null,
    videoId: video.video_id,
    startSec: song.start_sec,
    endSec: song.end_sec,
    channelName: video.channels?.name || T('common.unknown'),
    thumbnailUrl: video.thumbnail_url,
    videoTitle: video.title,
  };
}

export default function ArchiveClient({ video, songs }: Props) {
  const { playWithSource, state } = usePlayer();
  const { t, T } = useLocale();

  const playerSongs = songs.map((s) => toPlayerSong(s, video, T));

  const handlePlaySong = (song: Song) => {
    const ps = toPlayerSong(song, video, T);
    playWithSource(ps, playerSongs, 'video', video.video_id);
  };

  const handlePlayAll = () => {
    if (playerSongs.length > 0) {
      playWithSource(playerSongs[0], playerSongs, 'video', video.video_id);
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
            <p className="archive-header__channel">{T('common.unknown')}</p>
          )}
          <div className="archive-header__meta">
            <span>{songs.length} {T('archive.songs')}</span>
            <a
              href={`https://www.youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="archive-header__youtube-link"
            >
              <ExternalLink size={16} />
              {T('archive.watchOnYoutube')}
            </a>
          </div>
          <Link 
            href={`/songs/new?url=https://www.youtube.com/watch?v=${video.video_id}`} 
            className="btn btn--secondary btn--sm"
          >
            <Pencil size={14} />
            {T('archive.editSongs')}
          </Link>
        </div>
      </div>

      {/* 曲リスト */}
      {songs.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__text">
            {T('archive.noSongs')}
          </p>
          <Link href="/songs/new" className="btn btn--primary">
            {T('archive.registerSong')}
          </Link>
        </div>
      ) : (
        <div className="song-list">
          <div className="song-list__header">
            <span className="song-list__col-num">#</span>
            <span className="song-list__col-title">{T('archive.title')}</span>
            <span className="song-list__col-artist">{T('archive.artist')}</span>
            <span className="song-list__col-time">{T('archive.time')}</span>
            <span className="song-list__col-duration">{T('archive.duration')}</span>
            <span className="song-list__col-add"></span>
          </div>

          {songs.map((song, index) => {
            const isCurrentSong = state.currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => handlePlaySong(song)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlaySong(song);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`song-list__item ${isCurrentSong ? 'active' : ''} cursor-pointer`}
              >
                 <span className="song-list__col-num">
                   {isCurrentSong && state.isPlaying ? (
                     <span className="song-list__playing-icon">♪</span>
                   ) : (
                     index + 1
                   )}
                 </span>
                 <span className="song-list__col-title">
                   {t(song.master_songs?.title || T('common.unknown'), song.master_songs?.title_en || song.master_songs?.title || T('common.unknown'))}
                 </span>
                 <span className="song-list__col-artist">
                   {t(song.master_songs?.artist || '-', song.master_songs?.artist_en || song.master_songs?.artist || '-')}
                 </span>
                <span className="song-list__col-time">
                  {formatTime(song.start_sec)} - {formatTime(song.end_sec)}
                </span>
                <span className="song-list__col-duration">
                  {formatTime(song.end_sec - song.start_sec)}
                </span>
                <div className="song-list__col-add">
                  <SongMenu song={toPlayerSong(song, video, T)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
