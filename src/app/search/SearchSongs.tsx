'use client';

import { usePlayer } from '@/components/player/PlayerContext';
import { formatTime } from '@/lib/utils';
import { Music, Play, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { PlayerSong } from '@/types';

interface SearchSongsProps {
  songs: any[];
}

export default function SearchSongs({ songs }: SearchSongsProps) {
  const { playWithSource } = usePlayer();

  const toPlayerSong = (item: any): PlayerSong => {
    return {
      id: item.id,
      title: item.master_songs.title,
      artist: item.master_songs.artist,
      artworkUrl: item.master_songs.artwork_url,
      videoId: item.videos.video_id,
      startSec: item.start_sec,
      endSec: item.end_sec,
      channelName: item.videos.channels?.name || null,
      thumbnailUrl: null,
      videoTitle: item.videos.title
    };
  };

  const handlePlaySong = (item: any) => {
    const song = toPlayerSong(item);
    // 検索結果リスト全体をプレイリストとして渡す
    const playlist = songs.map(s => toPlayerSong(s));
    playWithSource(song, playlist, 'search', String(item.id));
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden divide-y divide-white/5 shadow-xl">
      {songs.map((song, index) => (
        <div 
          key={song.id} 
          onClick={() => handlePlaySong(song)}
          className="group grid grid-cols-[60px_1fr_1fr_100px] md:grid-cols-[80px_1fr_1fr_120px] px-6 py-4 gap-4 items-center hover:bg-white/10 transition-all relative cursor-pointer"
        >
          <div className="text-[#444] group-hover:text-[#ff4e8e] font-bold text-sm tabular-nums text-center transition-colors text-nowrap">
            {String(index + 1).padStart(2, '0')}
          </div>

          <div className="min-w-0 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
              {song.master_songs.artwork_url ? (
                <img src={song.master_songs.artwork_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Music size={16} className="text-[#333]" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={20} fill="white" className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#e0e0e0] truncate group-hover:text-[#ff4e8e] transition-colors">
                {song.master_songs.title}
              </div>
              <div className="text-sm text-[#666] truncate">{song.master_songs.artist}</div>
            </div>
          </div>

          <div className="hidden md:block min-w-0">
            <Link 
              href={`/videos/${song.videos.video_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-[#555] hover:text-[#ff4e8e] transition-colors flex flex-col gap-0.5 w-fit max-w-full group/video"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="truncate">{song.videos.title}</span>
                <ExternalLink size={12} className="shrink-0 opacity-40 group-hover/video:opacity-100 transition-opacity" />
              </div>
              {song.videos.channels && (
                <span className="text-[11px] text-[#444] truncate">{song.videos.channels.name}</span>
              )}
            </Link>
          </div>

          <div className="text-right text-[#555] font-bold text-sm tabular-nums">
            {formatTime(song.end_sec - song.start_sec)}
          </div>
        </div>
      ))}
    </div>
  );
}
