import { getChannels } from './actions';
import ChannelsClient from './ChannelsClient';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  return {
    title: `${t.sidebar.channels} | ${t.common.siteTitle}`,
    description: '登録されているVTuberのチャンネル一覧です。',
  };
}

export default async function ChannelsPage() {
  const result = await getChannels();

  if (!result.success) {
    return <ChannelsClient initialData={null} error={result.error} />;
  }

  return <ChannelsClient initialData={result.data} error={null} />;
}
