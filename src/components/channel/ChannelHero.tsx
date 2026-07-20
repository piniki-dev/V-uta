'use client';

import React from 'react';
import { Youtube, Twitter } from 'lucide-react';
import Hero from '@/components/Hero';
import type { Channel, Vtuber, Production } from '@/types';
import type { SubChannelInfo } from '@/app/songs/new/actions';
import { Tv } from 'lucide-react';

interface ChannelHeroProps {
  channel: Channel & {
    vtuber?: Vtuber & { production?: Production };
  };
  subChannels?: SubChannelInfo[];
}

export default function ChannelHero({ channel, subChannels }: ChannelHeroProps) {
  const totalChannelsCount = (subChannels?.length || 0) + 1;

  return (
    <Hero
      title={channel.name}
      image={channel.image || undefined}
      description={
        <div className="flex flex-col gap-2">
          {channel.vtuber && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[var(--text-secondary)] text-lg font-bold">
                {channel.vtuber.name}
              </span>
              {channel.vtuber.production && (
                <span className="text-[12px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-[var(--accent)] to-[#8e4eff] px-3 py-1 rounded-full shadow-lg shadow-[var(--accent-glow)]">
                  {channel.vtuber.production.name}
                </span>
              )}
            </div>
          )}

          {subChannels && subChannels.length > 0 && (
            <div className="flex items-center gap-2 mt-1 text-[13px] font-bold text-[var(--accent)] bg-[var(--accent-subtle)] px-3 py-1.5 rounded-xl border border-[var(--accent)]/20 w-fit">
              <Tv size={15} />
              <span>{totalChannelsCount}つのチャンネルを統合表示中</span>
              <span className="text-[11px] text-[var(--text-tertiary)] font-normal ml-1">
                ({subChannels.map(s => s.name).join(', ')})
              </span>
            </div>
          )}
        </div>
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
