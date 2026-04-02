'use client';

import React from 'react';
import Hero from '@/components/Hero';
import { Users } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface ChannelsHeroProps {
  count: number;
}

export default function ChannelsHero({ count }: ChannelsHeroProps) {
  const { T } = useLocale();

  return (
    <Hero
      title={T('sidebar.channels')}
      description={T('channels.description')}
      badge={`Explore • ${count} ${T('search.channels')}`}
      icon={<Users size={90} />}
    />
  );
}
