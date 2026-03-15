import { getChannelWithVideos } from '@/app/songs/new/actions';
import ChannelClient from './ChannelClient';
import { notFound } from 'next/navigation';

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
        <h2 style={{ color: 'var(--error)' }}>エラーが発生しました</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{result.error}</p>
      </div>
    );
  }

  return <ChannelClient initialData={result.data} />;
}
