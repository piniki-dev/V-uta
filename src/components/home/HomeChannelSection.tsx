'use client';

import { motion } from 'framer-motion';
import { useLocale } from '@/components/LocaleProvider';
import Link from 'next/link';
import Image from 'next/image';

interface Channel {
  id: number;
  handle: string | null;
  name: string | null;
  image: string | null;
}

interface HomeChannelSectionProps {
  channels: Channel[];
}

export default function HomeChannelSection({ channels }: HomeChannelSectionProps) {
  const { T } = useLocale();

  if (channels.length === 0) return null;

  return (
    <section>
      <motion.div 
        className="flex items-center gap-4 mb-8"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
      >
        <div className="w-2 h-8 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full" />
        <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
          {T('home.popularChannels')}
        </h2>
      </motion.div>

      <div className="flex overflow-x-auto pb-4 gap-6 no-scrollbar -mx-6 px-6">
        {channels.map((channel, index) => (
          <motion.div
            key={channel.name || index}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            viewport={{ once: true }}
          >
            <Link 
              href={`/channels/${encodeURIComponent(channel.handle || channel.id)}`}
              className="flex flex-col items-center gap-3 group"
            >
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-[var(--accent)] transition-all duration-300 shadow-lg">
                {channel.image ? (
                  <Image 
                    src={channel.image} 
                    alt={channel.name || ''} 
                    width={96}
                    height={96}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)]">
                    {channel.name?.slice(0, 1)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-xs md:text-sm font-bold text-[var(--text-primary)] text-center line-clamp-1 max-w-[100px] group-hover:text-[var(--accent)] transition-colors">
                {channel.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
