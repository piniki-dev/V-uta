'use client';

import React from 'react';
import { Youtube, Twitter } from 'lucide-react';
import Hero from '@/components/Hero';
import type { Channel, Vtuber, Production } from '@/types';

interface ChannelHeroProps {
  channel: Channel & {
    vtuber?: Vtuber & { production?: Production };
  };
}

export default function ChannelHero({ channel }: ChannelHeroProps) {
  return (
    <Hero
      title={channel.name}
      image={channel.image || undefined}
      description={
        channel.vtuber && (
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-secondary)] text-lg font-bold">
              {channel.vtuber.name}
            </span>
            {channel.vtuber.production && (
              <span className="text-[12px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] px-3 py-1 rounded-full shadow-lg shadow-[var(--accent-glow)]">
                {channel.vtuber.production.name}
              </span>
            )}
          </div>
        )
      }
      badge={channel.handle ? `@${channel.handle.replace('@', '')}` : undefined}
      actions={
        <>
          <a 
            href={`https://youtube.com/channel/${channel.yt_channel_id}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-8 py-3 rounded-2xl text-[14px] font-black bg-black/5 dark:bg-white/5 text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--youtube-red)] hover:text-white hover:border-transparent transition-all duration-300 active:scale-95 shadow-xl"
          >
            <Youtube size={18} /> YouTube
          </a>
          {channel.vtuber?.link && (
            <a 
              href={channel.vtuber.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-8 py-3 rounded-2xl text-[14px] font-black bg-black/5 dark:bg-white/5 text-[var(--text-primary)] border border-[var(--border)] hover:bg-[#1d9bf0] hover:text-white hover:border-transparent transition-all duration-300 active:scale-95 shadow-xl"
            >
              <Twitter size={18} /> Twitter
            </a>
          )}
        </>
      }
    />
  );
}
