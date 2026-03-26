'use client';

import { usePlayer } from './PlayerContext';
import { formatTime } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import { useSidebar } from '@/components/SidebarContext';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';

export default function FullPlayer() {
  const {
    state,
    play,
    seekTo,
  } = usePlayer();
  const { t, T } = useLocale();
  const { isOpen: isSidebarOpen } = useSidebar();

  if (!state.currentSong) return null;

  const duration = state.currentSong.endSec - state.currentSong.startSec;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const seekSec = state.currentSong!.startSec + (value / 100) * duration;
    seekTo(seekSec);
  };

  return (
    <div className={`full-player ${state.isFullPlayerOpen ? 'open' : 'closed'} ${isSidebarOpen ? 'sidebar-open' : ''} bg-[var(--bg-primary)] overflow-hidden`}>
      {/* 没入型背景 */}
      <div className="absolute inset-0 mesh-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)]/40 pointer-events-none" />

      <div className="full-player__body relative z-10 p-8 md:p-16 h-full flex flex-col md:flex-row gap-12">
        {/* 左: YouTube プレイヤー + 曲情報 */}
        <div className="flex-1 flex flex-col gap-10">
          <div className="full-player__main relative aspect-video rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/10 group">
            {/* PersistentPlayer will be positioned here when open */}
            <div className="full-player__video-placeholder w-full h-full bg-black/20 backdrop-blur-3xl animate-pulse" />
          </div>

          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, y: 30 }}
            animate={state.isFullPlayerOpen ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-[var(--text-primary)] glow-text drop-shadow-2xl">
              {t(state.currentSong.title, state.currentSong.title_en || state.currentSong.title)}
            </h2>
            <p className="text-xl md:text-2xl font-bold text-[var(--text-secondary)] opacity-80">
              {t(state.currentSong.artist || '-', state.currentSong.artist_en || state.currentSong.artist || '-')}
            </p>
          </motion.div>

          {/* カスタムシークバー */}
          <div className="space-y-4 mt-auto max-w-3xl">
            <div className="relative w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] shadow-[0_0_15px_var(--accent-glow)]"
                style={{ width: `${(state.currentTime - state.currentSong.startSec) / duration * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={(state.currentTime - state.currentSong.startSec) / duration * 100 || 0}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-sm font-black text-[var(--text-tertiary)] tracking-widest tabular-nums uppercase">
              <span>{formatTime(state.currentTime - state.currentSong.startSec)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* 右: 再生リスト (Queue) */}
        <div className="w-full md:w-96 flex flex-col bg-[var(--bg-secondary)]/30 backdrop-blur-2xl border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5">
            <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight glow-text-subtle flex items-center gap-3">
              <span className="w-1.5 h-6 bg-[var(--accent)] rounded-full shadow-[0_0_10px_var(--accent-glow)]" />
              {T('player.queue')}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scrollbar-hide">
            {state.playlist.map((song, index) => (
              <motion.button
                key={`${song.id}-${index}`}
                onClick={() => play(song, state.playlist)}
                className={`w-full group flex items-center gap-4 p-4 rounded-3xl transition-all duration-300 ${
                  index === state.currentIndex 
                    ? 'bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)]/10 border border-[var(--accent)]/30 shadow-[0_0_20px_var(--accent-glow)]/10' 
                    : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
                initial={{ opacity: 0, x: 20 }}
                animate={state.isFullPlayerOpen ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: index * 0.05 + 0.4 }}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black tabular-nums transition-all ${
                  index === state.currentIndex 
                    ? 'bg-[var(--accent)] text-white shadow-lg' 
                    : 'bg-white/5 text-[var(--text-tertiary)] group-hover:bg-white/10 group-hover:text-[var(--text-secondary)]'
                }`}>
                  {index + 1}
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className={`font-bold text-sm truncate leading-tight ${
                    index === state.currentIndex ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                  }`}>
                    {t(song.title, song.title_en || song.title)}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] opacity-60 mt-1 truncate">
                    {t(song.artist || '-', song.artist_en || song.artist || '-')}
                  </div>
                </div>

                <div className="text-[10px] font-black tabular-nums text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]">
                  {formatTime(song.endSec - song.startSec)}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
