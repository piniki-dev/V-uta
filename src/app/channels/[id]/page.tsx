import { getChannelWithVideos } from '@/app/songs/new/actions';
import ChannelView from './ChannelView';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { translations } from '@/lib/translations';
import JsonLd from '@/components/JsonLd';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const result = await getChannelWithVideos(decodedId);
  
  const cookieStore = await cookies();
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  if (!result.success) {
    return { title: t.common.errorOccurred };
  }

  const channel = result.data;
  if (!channel) {
    return { title: t.archive.notFound };
  }

  const description = locale === 'ja' 
    ? `${channel.name}の歌枠アーカイブ・セットリスト一覧。YouTubeのアーカイブから歌唱区間のみを抽出して連続再生・スキップ視聴が可能です。`
    : `List of karaoke archives and setlists by ${channel.name}. Play and skip through song segments from YouTube archives.`;

  return {
    title: `${channel.name} | ${t.common.siteTitle}`,
    description,
    openGraph: {
      title: `${channel.name} | ${t.common.siteTitle}`,
      description,
      images: channel.image ? [channel.image] : [],
    },
    twitter: {
      card: 'summary',
      title: `${channel.name} | ${t.common.siteTitle}`,
      description,
      images: channel.image ? [channel.image] : [],
    }
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const result = await getChannelWithVideos(decodedId);
  const cookieStore = await cookies();

  if (!result.success) {
    if (result.error?.includes('見つかりませんでした')) {
      notFound();
    }
    return (
      <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)' }}>Error Occurred</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{result.error || 'Unknown error'}</p>
      </div>
    );
  }

  const channel = result.data;
  if (!channel) {
    notFound();
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';
  const locale = (cookieStore.get('vuta-locale')?.value as 'ja' | 'en') || 'ja';
  const t = translations[locale];

  // アーティスト用の構造化データ
  // 型定義上は vtubers ですが、alias で vtuber として取得されています
  const vtuber = (channel as any).vtuber || channel.vtubers;

  const artistData = {
    "@context": "https://schema.org",
    "@type": "MusicArtist",
    "name": channel.name,
    "description": locale === 'ja'
      ? `${channel.name}の歌枠アーカイブ・セットリスト一覧。YouTubeアーカイブから歌唱区間のみを抽出して連続再生が可能です。`
      : `List of karaoke archives and setlists by ${channel.name}. Play song segments from YouTube archives.`,
    "image": channel.image,
    "url": `${baseUrl}/channels/${id}`,
    "sameAs": [
      `https://www.youtube.com/channel/${channel.yt_channel_id}`,
      vtuber?.link
    ].filter(Boolean) as string[],
    ...(vtuber?.production ? {
      "memberOf": {
        "@type": "Organization",
        "name": vtuber.production.name
      }
    } : {})
  };

  // パンくずリスト用の構造化データ
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
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": channel.name,
        "item": `${baseUrl}/channels/${id}`
      }
    ]
  };

  return (
    <>
      <JsonLd data={artistData} />
      <JsonLd data={breadcrumbData} />
      <ChannelView initialData={channel} />
    </>
  );
}
