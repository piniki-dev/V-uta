import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';
import { getHomeVideosCached } from '@/app/videos/actions';
import RecentlyVideoGrid from '@/components/recently/RecentlyVideoGrid';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.recently.title} | ${t.common.siteTitle}`,
    description: t.recently.description,
  };
}

export default async function RecentlyPage() {
  const videos = await getHomeVideosCached();
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return (
    <div className="min-h-screen py-12 pb-48">
      <div className="container mx-auto px-6 space-y-8">
        {/* ヘッダーセクション */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="w-2 h-10 bg-gradient-to-b from-[var(--accent)] to-[#8e4eff] rounded-full shadow-[0_0_20px_var(--accent-glow)]" />
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] glow-text-subtle">
              {t.recently.title}
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base ml-6 font-medium">
            {t.recently.description}
          </p>
        </div>

        {/* 動画一覧グリッド（チャンネル絞り込み付き） */}
        <RecentlyVideoGrid initialVideos={videos} />
      </div>
    </div>
  );
}
