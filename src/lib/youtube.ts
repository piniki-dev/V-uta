import type { YouTubeVideoMetadata } from '@/types';

/**
 * YouTube URL から動画IDを抽出する
 * 対応フォーマット:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/live/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // 動画ID直接入力の場合
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * YouTube の ISO 8601 形式の期間（PT1H2M10Sなど）を秒数に変換する
 */
export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * YouTube Data API v3 で動画メタデータを取得する
 */
export async function fetchVideoMetadata(
  videoId: string
): Promise<YouTubeVideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY が設定されていません');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,contentDetails&id=${videoId}&key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`YouTube API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const item = data.items[0];
  const snippet = item.snippet;
  const contentDetails = item.contentDetails;
  const liveDetails = item.liveStreamingDetails;
  // プレミア公開の場合、liveStreamingDetails を持つが actualStartTime が publishedAt と同じになる性質を利用
  const isStream = !!liveDetails && snippet.publishedAt !== liveDetails.actualStartTime;
  const duration = contentDetails?.duration ? parseISO8601Duration(contentDetails.duration) : 0;

  return {
    videoId,
    title: snippet.title,
    channelId: snippet.channelId,
    channelName: snippet.channelTitle,
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      '',
    publishedAt: snippet.publishedAt,
    isStream,
    duration,
    description: snippet.description || '',
  };
}

/**
 * テキストからURLを抽出し、X (Twitter) のリンクを優先的に取得する
 */
export function extractLinksFromText(text: string): string | null {
  if (!text) return null;

  // URL 抽出用の正規表現
  const urlRegex = /https?:\/\/[^\s\r\n]+/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  // 重複排除
  const urls = Array.from(new Set(matches));

  // X / Twitter のパターンのみを抽出
  const xPatterns = [
    /twitter\.com\/([a-zA-Z0-9_]+)$/,
    /twitter\.com\/([a-zA-Z0-9_]+)\?/,
    /x\.com\/([a-zA-Z0-9_]+)$/,
    /x\.com\/([a-zA-Z0-9_]+)\?/,
  ];

  for (const pattern of xPatterns) {
    const found = urls.find(url => pattern.test(url));
    if (found) return found;
  }

  return null;
}

/**
 * YouTube Data API v3 でチャンネル詳細情報を取得する
 */
export async function fetchChannelMetadata(
  channelId: string
): Promise<{
  ytChannelId: string;
  name: string;
  handle: string;
  description: string;
  image: string;
  officialLink?: string;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY が設定されていません');
  }

  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) {
    throw new Error(`YouTube API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const snippet = data.items[0].snippet;
  const description = snippet.description || '';
  const officialLink = extractLinksFromText(description);

  return {
    ytChannelId: channelId,
    name: snippet.title,
    handle: snippet.customUrl || '',
    description,
    image: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
    officialLink: officialLink || undefined,
  };
}
