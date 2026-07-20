import { translations } from '@/lib/translations';
import { getHomeVideosCached } from '@/app/videos/actions';
import RecentlyView from './RecentlyView';

export const revalidate = 3600; // 1時間ごとにISR再生成

export function generateMetadata() {
  const t = translations['ja'];

  return {
    title: `${t.recently.title} | ${t.common.siteTitle}`,
    description: t.recently.description,
  };
}

export default async function RecentlyPage() {
  const videos = await getHomeVideosCached();

  return <RecentlyView initialVideos={videos} />;
}
