import { getChannelWithVideos, getChannelMetadata, fetchChannelMetadataFromDb } from '@/app/songs/new/actions';
import { getAllChannelsForStatic } from '@/app/channels/actions';
import ChannelView from './ChannelView';
import { notFound, redirect } from 'next/navigation';
import { translations } from '@/lib/translations';
import JsonLd from '@/components/JsonLd';
import type { Metadata } from 'next';

function isPureAscii(str: string): boolean {
  return /^[\x20-\x7E]*$/.test(str);
}

export async function generateStaticParams() {
  const result = await getAllChannelsForStatic();
  if (!result.success || !result.data) {
    return [];
  }

  const params: { id: string }[] = [];
  result.data.forEach((channel) => {
    // ID パターン (100% ASCII)
    params.push({ id: String(channel.id) });
    // 英数字ハンドルの場合のみ static params に登録
    if (channel.handle && /^@[a-zA-Z0-9_-]+$/.test(channel.handle)) {
      params.push({ id: encodeURIComponent(channel.handle) });
      const cleanHandle = channel.handle.replace('@', '');
      if (cleanHandle !== channel.handle) {
        params.push({ id: encodeURIComponent(cleanHandle) });
      }
    }
  });

  return params;
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const decodedId = safeDecode(id);

  // 非 ASCII ハンドル等でのメタデータ生成時の例外を予防
  const result = (!isPureAscii(id) || !isPureAscii(decodedId))
    ? await fetchChannelMetadataFromDb(id)
    : await getChannelMetadata(id);
  
  const locale = 'ja';
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
    },
    twitter: {
      card: 'summary_large_image',
      title: `${channel.name} | ${t.common.siteTitle}`,
      description,
    }
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;
  const decodedId = safeDecode(id);
  const locale = 'ja';

  // 1. 非 ASCII 文字（日本語など）を含むハンドルで直接アクセスされた場合、
  // unstable_cache や Next.js のタグヘッダー注入で ERR_INVALID_CHAR が発生する前に
  // 非キャッシュ関数で安全にチャンネル ID を検索して数値 ID パス (/channels/15) へリダイレクト
  if (!isPureAscii(id) || !isPureAscii(decodedId)) {
    const metaRes = await fetchChannelMetadataFromDb(id);
    if (metaRes.success && metaRes.data) {
      redirect(`/channels/${metaRes.data.id}`);
    } else {
      notFound();
    }
  }

  // 2. 100% ASCII パス（数値 ID や英数字ハンドル）での正常データ取得
  const result = await getChannelWithVideos(id);

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

  // 3. サブ/トピックチャンネルからのリダイレクト優先
  if (channel.redirectTo) {
    redirect(channel.redirectTo);
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://v-uta.app';
  const t = translations[locale];

  // アーティスト用の構造化データ
  // 型定義上は vtubers ですが、alias で vtuber として取得されています
  const vtuber = channel.vtuber;

  const artistData = {
    "@context": "https://schema.org",
    "@type": "MusicArtist",
    "name": channel.name,
    "description": locale === 'ja'
      ? `${channel.name}の歌枠アーカイブ・セットリスト一覧。YouTubeアーカイブから歌唱区間のみを抽出して連続再生が可能です。`
      : `List of karaoke archives and setlists by ${channel.name}. Play song segments from YouTube archives.`,
    "image": channel.image,
    "url": `${baseUrl}/channels/${decodedId}`,
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
        "item": `${baseUrl}/channels/${decodedId}`
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
