'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, TrendingUp, Calendar, Clock, Globe } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { usePlayer } from '@/components/player/PlayerContext';
import Skeleton from '@/components/Skeleton';
import { getSongRankings, type FormattedRankingSong } from '@/app/history/actions';
import type { PlayerSong } from '@/types';

interface HomeRankingSectionProps {
  initialSongs: FormattedRankingSong[];
}

export default function HomeRankingSection({ initialSongs }: HomeRankingSectionProps) {
  const { T } = useLocale();
  const { playWithSource } = usePlayer();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [songs, setSongs] = useState<FormattedRankingSong[]>(initialSongs);
  const [isLoading, setIsLoading] = useState(false);

  const handlePeriodChange = async (newPeriod: 'daily' | 'weekly' | 'monthly') => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    setIsLoading(true);

    const daysMap = {
      daily: 1,
      weekly: 7,
      monthly: 30
    };

    const res = await getSongRankings({ days: daysMap[newPeriod], limit: 10 });
    if (res.success) {
      setSongs(res.data || []);
    }
    setIsLoading(false);
  };

  const onPlay = (song: FormattedRankingSong) => {
    const playerSong: PlayerSong = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      title_en: song.title_en,
      artist_en: song.artist_en,
      artworkUrl: song.artworkUrl,
      videoId: song.videoId,
      startSec: song.startSec,
      endSec: song.endSec,
      channelName: song.channelName,
      channelThumbnailUrl: song.channelThumbnailUrl,
      thumbnailUrl: song.thumbnailUrl,
      videoTitle: song.videoTitle,
    };
    
    // ランキング全体をプレイリストとして渡す
    const playlist: PlayerSong[] = songs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      title_en: s.title_en,
      artist_en: s.artist_en,
      artworkUrl: s.artworkUrl,
      videoId: s.videoId,
      startSec: s.startSec,
      endSec: s.endSec,
      channelName: s.channelName,
      channelThumbnailUrl: s.channelThumbnailUrl,
      thumbnailUrl: s.thumbnailUrl,
      videoTitle: s.videoTitle,
    }));

    playWithSource(playerSong, playlist, 'ranking', period);
  };

  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-2 h-8 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full" />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              {T('home.songRanking')}
            </h2>
            <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-widest mt-1">
              Trending music highlights
            </p>
          </div>
        </motion.div>

        {/* 期間切り替えタブ */}
        <div className="flex p-1 bg-[var(--bg-tertiary)]/50 backdrop-blur-md rounded-2xl border border-[var(--border)] self-start md:self-auto">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === p 
                  ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {T(`home.rankingPeriods.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)]/30 backdrop-blur-sm rounded-[32px] border border-[var(--border)] overflow-hidden shadow-xl">
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-4"
              >
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-lg" />
                    <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3" />
                      <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : songs.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center"
              >
                <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-tertiary)]">
                  <TrendingUp size={24} />
                </div>
                <p className="text-[var(--text-secondary)] font-medium">
                  {T('playlist.noSongs')}
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="divide-y divide-[var(--border)]/50"
              >
                {songs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)]/40 transition-colors cursor-pointer"
                    onClick={() => onPlay(song)}
                  >
                    {/* 順位 */}
                    <div className="w-8 flex justify-center">
                      <span className={`text-lg font-black ${
                        index === 0 ? 'text-[var(--accent)]' : 
                        index === 1 ? 'text-[#8e4eff]' : 
                        index === 2 ? 'text-[#b388ff]' : 
                        'text-[var(--text-tertiary)]'
                      }`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* サムネイル */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                      <img 
                        src={song.artworkUrl || `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`} 
                        alt={song.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={20} fill="white" className="text-white ml-0.5" />
                      </div>
                    </div>

                    {/* 情報 (左側) */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--text-primary)] text-sm md:text-base truncate group-hover:text-[var(--accent)] transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-[11px] md:text-xs text-[var(--text-tertiary)] font-medium truncate">
                        {song.artist}
                      </p>
                    </div>

                    {/* チャンネル情報 (右寄せ) */}
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0 px-2 md:px-4">
                      <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/60 px-3 py-1.5 rounded-full border border-[var(--border)]/40 max-w-[140px] md:max-w-[220px] transition-all hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent)]/30">
                        {song.channelThumbnailUrl && (
                          <img 
                            src={song.channelThumbnailUrl} 
                            alt="" 
                            className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover flex-shrink-0 border border-white/20 shadow-sm"
                          />
                        )}
                        <p className="text-xs md:text-sm text-[var(--text-primary)] font-bold truncate tracking-tight">
                          {song.channelName}
                        </p>
                      </div>
                    </div>

                    {/* 再生回数 */}
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold text-xs bg-[var(--bg-tertiary)]/30 px-3 py-1.5 rounded-xl border border-[var(--border)]/30 flex-shrink-0 ml-2">
                      <TrendingUp size={12} className="text-[var(--accent)]" />
                      {song.playCount}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
