import { createClient } from '@/utils/supabase/server';
import type { Video } from '@/types';
import Link from 'next/link';

export default async function HomePage() {
  const supabase = await createClient();

  const { data: videos } = await supabase
    .from('videos')
    .select('*, channels(*)')
    .order('created_at', { ascending: false })
    .limit(12);

  return (
    <div className="page-container">
      <section className="hero">
        <h1 className="hero__title">
          VTuber の歌を、
          <br />
          <span className="hero__accent">もっと手軽に。</span>
        </h1>
        <p className="hero__description">
          歌枠アーカイブから歌区間だけを抽出して連続再生。
          <br />
          お気に入りの歌を見つけよう。
        </p>
        <Link href="/songs/new" className="btn btn--primary btn--lg">
          歌を登録する
        </Link>
      </section>

      {/* 最近追加されたアーカイブ */}
      <section className="section">
        <h2 className="section__title">最近のアーカイブ</h2>
        {(!videos || videos.length === 0) ? (
          <div className="empty-state">
            <p className="empty-state__text">
              まだアーカイブが登録されていません。
              <br />
              最初の歌を登録してみましょう！
            </p>
          </div>
        ) : (
          <div className="video-grid">
            {(videos as Video[]).map((video) => (
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
                  <p className="video-card__channel">{video.channels?.name || '(不明)'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
