import { getChannels } from './actions';
import ChannelsView from './ChannelsView';
import { translations } from '@/lib/translations';
import JsonLd from '@/components/JsonLd';
import { getChannelUrl } from '@/lib/utils';

export function generateMetadata() {
  const t = translations['ja'];

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

  const channels = result.data || [];
  const locale = 'ja';
  const t = translations[locale];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';

  // ItemList 構造化データ
  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": t.sidebar.channels,
    "numberOfItems": channels.length,
    "itemListElement": channels.map((channel, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": channel.name,
      "url": `${baseUrl}${getChannelUrl(channel)}`
    }))
  };

  // パンくずリスト 構造化データ
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": t.sidebar.home,
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": t.sidebar.channels,
        "item": `${baseUrl}/channels`
      }
    ]
  };

  return (
    <>
      <JsonLd data={itemListData} />
      <JsonLd data={breadcrumbData} />
      <ChannelsView channels={channels} />
    </>
  );
}
