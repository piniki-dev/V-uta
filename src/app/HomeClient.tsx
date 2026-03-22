'use client';

import { createClient } from '@/utils/supabase/client';
import type { Video } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';

export default function HomeClient() {
  const [videos, setVideos] = useState<Video[]>([]);
  const { T } = useLocale();

  useEffect(() => {
    const fetchVideos = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('videos')
        .select('*, channels(*)')
        .order('created_at', { ascending: false })
        .limit(12);
      if (data) setVideos(data as Video[]);
    };
    fetchVideos();
  }, []);

  return (
    <div className="page-container">
      <section className="hero">
        <h1 className="hero__title">
          {T('home.heroTitle1')}
          <br />
          <span className="hero__accent">{T('home.heroTitle2')}</span>
        </h1>
        <p className="hero__description">
          {T('home.heroSub1')}
          <br />
          {T('home.heroSub2')}
        </p>
        <Link href="/songs/new" className="btn btn--primary btn--lg">
          {T('home.registerBtn')}
        </Link>
      </section>

      {/* 最近追加されたアーカイブ */}
      <section className="section">
        <h2 className="section__title">{T('home.recentArchives')}</h2>
        {(!videos || videos.length === 0) ? (
          <div className="empty-state">
            <p className="empty-state__text">
              {T('home.noArchives')}
              <br />
              {T('home.registerFirst')}
            </p>
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.video_id}`}
                className="video-card"
              >
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="video-card__thumbnail"
                  />
                )}
                <div className="video-card__info">
                  <h3 className="video-card__title">{video.title}</h3>
                  <p className="video-card__channel">{video.channels?.name || T('common.unknown')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
