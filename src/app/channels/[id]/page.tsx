import { getChannelWithVideos } from '@/app/songs/new/actions';
import ChannelView from './ChannelView';
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
    return (
      <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)' }}>Error Occurred</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{result.error}</p>
      </div>
    );
  }

  return <ChannelView initialData={result.data} />;
}
