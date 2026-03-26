'use client';

import { useLocale } from '@/components/LocaleProvider';
import SearchSongs from './SearchSongs';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchClientProps {
  query: string;
  songs: any[];
  videos: any[];
  channels: any[];
}

export default function SearchClient({ query, songs, videos, channels }: SearchClientProps) {
  const { T } = useLocale();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  } as const;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 検索ヘッダー */}
      <motion.section 
        className="relative overflow-hidden border-b border-[var(--border)] py-16 mesh-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-primary)]/5 to-[var(--bg-primary)]/10 pointer-events-none" />
        
        <div className="container relative z-10 w-full px-6">
          <header>
            <motion.h1 
              className="text-4xl sm:text-5xl font-black mb-6 tracking-tight text-[var(--text-primary)] glow-text"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {T('search.title')}
            </motion.h1>
            
            {!query ? (
              <motion.p 
                className="text-[var(--text-secondary)] text-lg font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {T('search.inputKeyword')}
              </motion.p>
            ) : (
              <motion.div 
                className="flex flex-col gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-[var(--text-secondary)] text-xl font-medium">
                  {T('search.resultsFor', { query })}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black bg-[var(--accent-subtle)] text-[var(--accent)] px-4 py-1.5 rounded-full border border-[var(--accent)]/20 shadow-lg shadow-[var(--accent-glow)]/10">
                    {songs.length + videos.length + channels.length > 0 
                      ? T('search.found')
                      : T('search.notFound')}
                  </span>
                </div>
              </motion.div>
            )}
          </header>
        </div>
      </motion.section>

      {query && (
        <div className="container py-20 pb-48">
          <div className="space-y-32">
            {/* 楽曲セクション */}
            <section>
              <motion.div 
                className="flex items-center gap-4 mb-10"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
                <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
                  {T('search.songs')}
                  <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[var(--accent)] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                    {songs.length}
                  </span>
                </h2>
              </motion.div>
              
              {songs.length > 0 ? (
                <SearchSongs songs={songs} />
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {T('search.notFound')}
                </div>
              )}
            </section>

            {/* アーカイブセクション */}
            <section>
              <motion.div 
                className="flex items-center gap-4 mb-10"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-10 bg-gradient-to-b from-[#ff8e4e] to-[#ff4e8e] rounded-full shadow-[0_0_20px_rgba(255,142,78,0.3)]" />
                <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
                  {T('search.archives')}
                  <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[#ff8e4e] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                    {videos.length}
                  </span>
                </h2>
              </motion.div>

              {videos.length > 0 ? (
                <motion.div 
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {videos.map(video => (
                    <motion.div key={video.id} variants={itemVariants}>
                      <Link 
                        href={`/videos/${video.video_id}`}
                        className="group flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl overflow-hidden hover:border-[var(--accent)]/30 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-2 active:scale-[0.98] h-full"
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`} 
                            alt="" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-2xl">
                              <ExternalLink size={24} />
                            </div>
                          </div>
                        </div>
                        <div className="p-6 flex-1 flex flex-col gap-3">
                          <h3 className="font-bold text-[15px] text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors min-h-[2.4em]">
                            {video.title}
                          </h3>
                          {video.channels?.name && (
                            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] mt-auto flex items-center gap-2">
                              <span className="w-1 h-1 bg-[var(--accent)] rounded-full" />
                              {video.channels.name}
                            </p>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {T('search.notFound')}
                </div>
              )}
            </section>

            {/* チャンネルセクション */}
            <section>
              <motion.div 
                className="flex items-center gap-4 mb-10"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-10 bg-gradient-to-b from-[#4e8eff] to-[#8e4eff] rounded-full shadow-[0_0_20px_rgba(78,142,255,0.3)]" />
                <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-4 glow-text-subtle">
                  {T('search.channels')}
                  <span className="text-sm font-black bg-[var(--bg-tertiary)] text-[#4e8eff] px-4 py-1 rounded-full border border-[var(--border)] shadow-inner">
                    {channels.length}
                  </span>
                </h2>
              </motion.div>

              {channels.length > 0 ? (
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {channels.map(channel => (
                    <motion.div key={channel.id} variants={itemVariants}>
                      <Link 
                        href={`/channels/${channel.handle || channel.id}`}
                        className="flex items-center gap-6 p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-3xl hover:border-[var(--accent)]/30 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1 transition-all duration-500 group"
                      >
                        <div className="relative">
                          {/* アバター背後のグロー */}
                          <div className="absolute inset-0 bg-[var(--accent)]/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <img 
                            src={channel.image || '/placeholder-avatar.jpg'} 
                            alt="" 
                            className="relative z-10 w-20 h-20 rounded-full object-cover shadow-2xl ring-2 ring-white/10 group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate mb-1">
                            {channel.name}
                          </div>
                          {channel.handle && (
                            <div className="text-sm font-bold text-[var(--text-tertiary)] truncate bg-[var(--bg-tertiary)] w-fit px-3 py-0.5 rounded-full border border-[var(--border)]">
                              @{channel.handle.replace('@', '')}
                            </div>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center text-[var(--text-tertiary)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-300">
                          <ExternalLink size={18} />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="py-20 bg-[var(--bg-secondary)] rounded-3xl border border-dashed border-[var(--border)] text-center text-[var(--text-tertiary)] font-medium">
                  {T('search.notFound')}
                </div>
              )}
            </section>

            {songs.length === 0 && videos.length === 0 && channels.length === 0 && (
              <motion.div 
                className="text-center py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--text-tertiary)] border border-[var(--border)]">
                  <X size={32} />
                </div>
                <p className="text-[var(--text-secondary)] text-lg font-medium">
                  {T('search.tryAnother')}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
