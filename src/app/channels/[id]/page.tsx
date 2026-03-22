import { getChannelWithVideos } from '@/app/songs/new/actions';
import ChannelClient from './ChannelClient';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const result = await getChannelWithVideos(decodedId);
  
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  if (!result.success || !result.data) {
    return { title: t.common.errorOccurred };
  }

  return {
    title: `${result.data.name} | ${t.common.siteTitle}`,
    description: result.data.description,
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;
  
  // デコードされた識別子を取得 (例: %40HoushouMarine -> @HoushouMarine)
  const decodedId = decodeURIComponent(id);

  const result = await getChannelWithVideos(decodedId);

  if (!result.success) {
    if (result.error.includes('見つかりませんでした')) {
      notFound();
    }
    return <ChannelClient initialData={null} error={result.error} />;
  }

  return <ChannelClient initialData={result.data} error={null} />;
}
