import { getChannels } from './actions';
import ChannelsView from './ChannelsView';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.sidebar.channels} | ${t.common.siteTitle}`,
    description: t.channels.description,
  };
}

export default async function ChannelsPage() {
  const result = await getChannels();

  if (!result.success) {
    return (
      <div className="container py-24 text-center">
        <h2 className="text-2xl font-bold text-[var(--error)] mb-4">Error Occurred</h2>
        <p className="text-[var(--text-secondary)]">{result.error}</p>
      </div>
    );
  }

  return <ChannelsView channels={result.data || []} />;
}
